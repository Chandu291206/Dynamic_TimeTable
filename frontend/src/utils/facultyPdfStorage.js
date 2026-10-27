import { extractPdfText, proxyPdfUrl, updateFaculty } from '../api/admin.js'

const DB_NAME = 'faculty-profiles-db'
const DB_VERSION = 1
const STORE_NAME = 'faculty_pdfs'

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'))
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'facultyId' })
      }
    }
  })
}

/**
 * Saves a downloaded faculty PDF directly into browser local storage (IndexedDB with localStorage fallback).
 */
export async function savePdfToBrowserStorage(facultyId, pdfUrl, arrayBuffer, metadata = {}) {
  const timestamp = new Date().toISOString()
  try {
    const db = await openDatabase()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record = {
        facultyId: Number(facultyId),
        pdfUrl,
        data: arrayBuffer,
        byteLength: arrayBuffer.byteLength,
        name: metadata.name || '',
        staffId: metadata.staffId || '',
        department: metadata.department || '',
        storedAt: timestamp,
      }
      const request = store.put(record)
      request.onsuccess = () => resolve(record)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    // Fallback: localStorage as base64 if small enough
    try {
      let binary = ''
      const bytes = new Uint8Array(arrayBuffer)
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = window.btoa(binary)
      window.localStorage.setItem(
        `faculty_pdf_${facultyId}`,
        JSON.stringify({
          facultyId: Number(facultyId),
          pdfUrl,
          base64,
          name: metadata.name || '',
          storedAt: timestamp,
        })
      )
      return { facultyId, pdfUrl, storedAt: timestamp }
    } catch {
      console.warn('Could not store PDF in localStorage fallback:', err.message)
      return null
    }
  }
}

/**
 * Retrieves a stored PDF from browser storage.
 */
export async function getPdfFromBrowserStorage(facultyId) {
  try {
    const db = await openDatabase()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(Number(facultyId))
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    const raw = window.localStorage?.getItem(`faculty_pdf_${facultyId}`)
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Lists all faculty IDs that have PDFs stored in browser storage.
 */
export async function listStoredBrowserPdfs() {
  try {
    const db = await openDatabase()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

/**
 * Deletes a stored PDF from browser local storage (IndexedDB and localStorage).
 */
export async function deletePdfFromBrowserStorage(facultyId) {
  try {
    const db = await openDatabase()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(Number(facultyId))
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // ignore
  }

  try {
    window.localStorage?.removeItem(`faculty_pdf_${facultyId}`)
  } catch {
    // ignore
  }
}

/**
 * Clears all stored PDFs from browser local storage.
 */
export async function clearAllStoredBrowserPdfs() {
  try {
    const db = await openDatabase()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // ignore
  }

  try {
    const keysToRemove = []
    for (let i = 0; i < (window.localStorage?.length || 0); i++) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith('faculty_pdf_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

/**
 * Heuristically extracts qualifications, designation, and email from text scraped from the PDF.
 */
export function extractValuesFromPdfText(text = '') {
  const result = {}
  if (!text) return result

  // Match qualification (e.g., Ph.D, M.Tech, M.E., M.Sc, B.Tech)
  const qualMatch = text.match(/\b(Ph\.?D\.?|M\.?Tech\.?|M\.?E\.?|M\.?S\.?|M\.?Phil\.?|MCA|M\.?Sc\.?)\b/i)
  if (qualMatch) {
    result.qualification = qualMatch[1].trim()
  }

  // Match designation
  const desigMatch = text.match(
    /\b(Professor\s*&\s*Principal|Professor\s*&\s*HOD|Professor\s*&\s*Head|Associate\s+Professor|Assistant\s+Professor|Professor)\b/i
  )
  if (desigMatch) {
    result.designation = desigMatch[1].trim()
  }

  // Match email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch) {
    result.email = emailMatch[0].trim()
  }

  return result
}

/**
 * Processes queued PDF profiles:
 * 1. Downloads the PDF binary.
 * 2. Saves the PDF file temporarily in local browser storage (IndexedDB).
 * 3. Extracts text and scraped values.
 * 4. Sends ONLY the scraped values back to the backend database.
 * 5. Automatically deletes the locally stored PDF once processing is complete.
 */
export async function processPdfQueue(pdfQueue = [], onProgress) {
  if (!Array.isArray(pdfQueue) || pdfQueue.length === 0) {
    return { total: 0, savedInBrowser: 0, valuesSent: 0 }
  }

  let savedInBrowser = 0
  let valuesSent = 0

  for (let i = 0; i < pdfQueue.length; i++) {
    const item = pdfQueue[i]
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: pdfQueue.length,
        item,
        phase: 'downloading',
      })
    }

    try {
      // 1. Download PDF into browser memory
      const fetchUrl = proxyPdfUrl(item.pdfUrl)
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await fetch(fetchUrl, { headers })
      if (!response.ok) {
        throw new Error(`Failed to download PDF: HTTP ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()

      // 2. Temporarily store the PDF in local browser storage
      await savePdfToBrowserStorage(item.facultyId, item.pdfUrl, arrayBuffer, {
        name: item.name,
        staffId: item.staffId,
        department: item.department,
      })
      savedInBrowser += 1

      // 3. Extract text from the PDF without saving the PDF to backend
      const parseRes = await extractPdfText({ url: item.pdfUrl })
      const rawText = parseRes?.data?.text || ''
      const scrapedValues = extractValuesFromPdfText(rawText)

      // 4. Send ONLY the scraped values (not the PDF) to backend
      if (Object.keys(scrapedValues).length > 0) {
        const updatePayload = {}
        if (scrapedValues.qualification) updatePayload.qualification = scrapedValues.qualification
        if (scrapedValues.designation) updatePayload.designation = scrapedValues.designation
        if (scrapedValues.email) updatePayload.email = scrapedValues.email

        await updateFaculty(item.facultyId, updatePayload)
        valuesSent += 1
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: pdfQueue.length,
          item,
          phase: 'completed',
          extracted: scrapedValues,
        })
      }
    } catch (err) {
      console.warn(`Error processing PDF for ${item.name} (${item.pdfUrl}):`, err.message)
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: pdfQueue.length,
          item,
          phase: 'failed',
          error: err.message,
        })
      }
    } finally {
      // 5. Clean up / delete the locally stored PDF once processing and updates are done
      try {
        await deletePdfFromBrowserStorage(item.facultyId)
      } catch {
        // ignore cleanup errors
      }
    }
  }

  return { total: pdfQueue.length, savedInBrowser, valuesSent }
}

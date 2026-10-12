function me(req, res) {
  return res.json({ success: true, data: { user: req.user } });
}

module.exports = { me };

const prisma = require('../src/config/database');

async function main() {
  const faculty = await prisma.faculty.findMany({
    select: {
      id: true,
      name: true,
      staffId: true,
      department: true,
      imageSourceUrl: true,
      profileSourceUrl: true,
      imageData: true,
    },
  });

  console.log(
    JSON.stringify(
      faculty.map((f) => ({
        id: f.id,
        name: f.name,
        staffId: f.staffId,
        department: f.department,
        imageSourceUrl: f.imageSourceUrl,
        profileSourceUrl: f.profileSourceUrl,
        hasImageData: Boolean(f.imageData),
      })),
      null,
      2
    )
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

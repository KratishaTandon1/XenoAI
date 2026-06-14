import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Clearing old data...')
  await prisma.communicationLog.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.order.deleteMany()
  await prisma.customer.deleteMany()

  console.log('Seeding customers...')
  
  const customers = [
    { name: 'Alice Smith', email: 'alice@example.com', phone: '+1234567890' },
    { name: 'Bob Jones', email: 'bob@example.com', phone: '+1234567891' },
    { name: 'Charlie Brown', email: 'charlie@example.com', phone: '+1234567892' },
    { name: 'Diana Prince', email: 'diana@example.com', phone: '+1234567893' },
    { name: 'Evan Wright', email: 'evan@example.com', phone: '+1234567894' },
    { name: 'Fiona Gallagher', email: 'fiona@example.com', phone: '+1234567895' },
    { name: 'George Costanza', email: 'george@example.com', phone: '+1234567896' },
    { name: 'Hannah Abbott', email: 'hannah@example.com', phone: '+1234567897' },
    { name: 'Ian Malcolm', email: 'ian@example.com', phone: '+1234567898' },
    { name: 'Julia Child', email: 'julia@example.com', phone: '+1234567899' },
  ]

  const createdCustomers = []
  for (const c of customers) {
    const customer = await prisma.customer.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        // Randomly set createdAt between now and 6 months ago
        createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 180)
      }
    })
    createdCustomers.push(customer)
  }

  console.log('Seeding orders...')
  
  // Create orders for 70% of customers
  for (const customer of createdCustomers) {
    if (Math.random() > 0.3) {
      // Create 1 to 5 orders for this customer
      const numOrders = Math.floor(Math.random() * 5) + 1
      for (let i = 0; i < numOrders; i++) {
        await prisma.order.create({
          data: {
            customerId: customer.id,
            amount: parseFloat((Math.random() * 100 + 10).toFixed(2)),
            status: Math.random() > 0.1 ? 'completed' : 'refunded',
            // Randomly set order date between customer creation and now
            createdAt: new Date(customer.createdAt.getTime() + Math.random() * (Date.now() - customer.createdAt.getTime()))
          }
        })
      }
    }
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

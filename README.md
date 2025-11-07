



# 🟣 Circle App — Backend API

Backend untuk aplikasi Circle, sebuah platform berbasis komunitas untuk berbagi postingan, like, dan komentar.  
Dibangun menggunakan **Express**, **Prisma ORM**, dan **PostgreSQL** dengan autentikasi berbasis JWT.



## 🚀 Tech Stack

- 🟢 **Node.js + Express**
- 🧱 **Prisma ORM**
- 🐘 **PostgreSQL**
- 🔐 **JWT Authentication**
- 🧂 **Bcrypt** (Hash Password)
- 🧵 **Multer** (Upload file)
- 🧪 **Postman API Documentation**



## 📁 Struktur Folder
```

src/
│
├── prisma/ # Schema & migration Prisma
├── middleware/ # Middleware (auth, error handler, dsb)
├── controllers/ # Logic tiap endpoint
├── routes/ # Router express
├── utils/ # Helper function (token, response)
└── app.ts # Entry point utama
```

---

## ⚙️ Instalasi & Setup

### 1️⃣ Clone Repository
```bash
git clone https://github.com/username/circle-backend.git
cd circle-backend
npm install
```
```
DATABASE_URL="postgresql://user:password@localhost:5432/circle_db?schema=public"
JWT_SECRET="your_secret_key"
```
```
npx prisma migrate dev
npm run dev
```

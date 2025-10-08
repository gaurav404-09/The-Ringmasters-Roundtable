# 🎪 Ringmaster's Roundtable

A comprehensive travel planning application that helps you organize and manage your trips with ease. Built with React, Vite, Node.js, and Tailwind CSS, this application offers a seamless experience for planning and tracking your travel adventures.

## 🌟 Features

- 🗓️ Itinerary Planning - Plan your daily activities and destinations
- 💰 Budget Tracking - Keep track of your travel expenses
- ⛅ Weather Forecast - Check weather conditions for your travel dates
- 🛣️ Route Planning - Plan your travel routes between destinations
- 🎉 Events - Discover local events at your travel destination
- 🏨 Accommodation - Manage your hotel and lodging information
- 🍽️ Restaurant Recommendations - Find places to eat at your destination
- 🔄 Real-time Updates - Get live updates on your travel plans
- 📱 Responsive Design - Works on desktop and mobile devices

## 🛠️ Tech Stack

### Frontend
- ⚛️ React 18
- 🚀 Vite
- 🎨 Tailwind CSS
- 🛣️ React Router v6
- 📅 Date-fns (for date manipulation)
- 🌐 React Icons & Lucide Icons
- 🔄 Socket.IO Client (for real-time features)
- 📱 Framer Motion (for animations)

### Backend
- 🟢 Node.js with Express
- 🔌 Socket.IO (for real-time communication)
- 🔐 JWT Authentication
- 📦 MongoDB (for data storage)
- 🔄 RESTful API

## 🚀 Quick Start (Windows PowerShell)

Run both frontend and backend with a single command:

```powershell
# Install dependencies (first time only)
npm install

# Start both frontend and backend (Windows)
.\start-all.ps1
```

This will start:
- Frontend at [http://localhost:5173](http://localhost:5173)
- Backend API at [http://localhost:3000](http://localhost:3000)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm (v8 or later) or yarn
- Git

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/Webster-2025/The-Ringmasters-Roundtable.git
   cd The-Ringmasters-Roundtable
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

### Running the Application

#### Option 1: Single Command (Windows PowerShell) - RECOMMENDED

Run both frontend and backend with a single PowerShell command:

```powershell
# Run this in PowerShell from the project root
.\start-all.ps1
```

This will start:
- Frontend at [http://localhost:5173](http://localhost:5173) (in one window)
- Backend API at [http://localhost:3000](http://localhost:3000) (in another window)

> **Note:** Make sure both servers are running for full functionality. The frontend communicates with the backend for data and real-time features.

## 🛠️ Detailed Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Webster-2025/The-Ringmasters-Roundtable.git
   cd The-Ringmasters-Roundtable
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the backend directory:
   ```
   PORT=3000
   ENABLE_RABBITMQ=true
   ```

4. **Start the backend server**
   ```bash
   node server.js
   ```

5. **Access the application**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:3000](http://localhost:3000)
The-Ringmasters-Roundtable/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   │   ├── Home.jsx
│   │   ├── AuthPage.jsx
│   │   ├── PlanTrip.jsx
│   │   ├── Itinerary.jsx
│   │   ├── Budget.jsx
│   │   ├── Weather.jsx
│   │   ├── Routes.jsx
│   │   └── Compare.jsx
│   ├── context/            # React context providers
│   ├── App.jsx             # Main App component
│   └── main.jsx            # Application entry point
│
├── backend/                # Backend server
│   ├── controllers/        # Request handlers
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── server.js           # Server entry point
│
├── public/                 # Static files
└── package.json            # Project configuration
```

## 📝 Available Scripts

### Frontend
- `npm run dev` - Start the frontend development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally

### Backend
- `cd backend && npm run dev` - Start the backend development server
- `cd backend && npm start` - Start the backend in production mode

### Combined
- `npm run start:full` - Start both frontend and backend in development mode using concurrently
- `npm run dev:backend` - Start only the backend development server
- `npm run dev` - Start only the frontend development server
- `npm run build` - Build the frontend for production
- `npm run preview` - Preview the production build locally

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Icons](https://react-icons.github.io/react-icons/)

---

Made with ❤️ by The Ringmasters Roundtable

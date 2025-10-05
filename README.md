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

## 🚀 Quick Start (Single Command Setup)

Run both frontend and backend with a single command:

```bash
# Install dependencies (first time only)
npm install
cd backend && npm install && cd ..

# Start both frontend and backend
npm run start:full
```

This will start:
- Frontend at [http://localhost:5173](http://localhost:5173)
- Backend API at [http://localhost:5000](http://localhost:5000)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm (v8 or later) or yarn
- Git

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ringmasters-roundtable.git
   cd ringmasters-roundtable
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

### Running the Application

1. Start the frontend development server:
   ```bash
   npm run dev
   ```

2. In a new terminal, start all backend services:
   ```bash
   ./start-all.sh
   ```

3. The application will be available at:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

> **Note:** Make sure to run both the frontend and backend services for full functionality.

## 🛠️ Detailed Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (for local development)

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
   VITE_API_URL=http://localhost:5000
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
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
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```

4. **Start the backend server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000](http://localhost:5000)

## 🏗️ Project Structure

```
The-Ringmasters-Roundtable/
├── src/                    # Frontend source code
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

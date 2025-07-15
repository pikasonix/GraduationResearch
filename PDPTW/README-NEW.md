# PDPTW Solver - Express.js + React.js Architecture

A modern, scalable solution for solving Pickup and Delivery Problem with Time Windows (PDPTW) using advanced optimization algorithms.

## 🏗️ Architecture Overview

This application has been refactored into a modern microservices architecture:

- **Backend**: Express.js REST API server with Node.js
- **Frontend**: React.js with TailwindCSS for modern UI
- **Algorithms**: C++ executables for high-performance optimization
- **Communication**: RESTful APIs with JSON data exchange

## 📁 Project Structure

```
PDPTW/
├── backend/                    # Express.js API Server
│   ├── app.js                 # Main server application
│   ├── package.json           # Node.js dependencies
│   ├── .env                   # Environment configuration
│   ├── start.sh               # Linux/Mac startup script
│   ├── start.bat              # Windows startup script
│   ├── uploads/               # Temporary file uploads
│   ├── results/               # Algorithm results
│   └── logs/                  # Application logs
│
├── frontend-react/            # React.js Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Application pages
│   │   ├── services/         # API client and utilities
│   │   ├── hooks/            # Custom React hooks
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   ├── package.json          # React dependencies
│   ├── vite.config.js        # Vite build configuration
│   ├── tailwind.config.js    # TailwindCSS configuration
│   ├── start.sh              # Linux/Mac startup script
│   └── start.bat             # Windows startup script
│
├── visualizer/                # Original visualizer directory
│   └── public/               # Algorithm executables
│       └── PDPTW_HYBRID_ACO_GREEDY_V3.exe  # Main algorithm
│
├── dataset/                   # Test instances and solutions
├── validator/                 # Solution validation tools
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **Git** (for cloning the repository)

### Backend Setup (Express.js)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the server:
   ```bash
   # Linux/Mac
   ./start.sh
   
   # Windows
   start.bat
   
   # Or directly with npm
   npm start
   ```

The backend server will start on `http://localhost:5000`

### Frontend Setup (React.js)

1. Navigate to the frontend directory:
   ```bash
   cd frontend-react
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   # Linux/Mac
   ./start.sh
   
   # Windows
   start.bat
   
   # Or directly with npm
   npm run dev
   ```

The frontend will start on `http://localhost:3000`

## 🔧 API Endpoints

The Express.js backend provides the following REST API endpoints:

### System Health
- `GET /api/health` - System health check and status

### Algorithms
- `GET /api/algorithms` - Get available algorithms and their status

### Problem Solving
- `POST /api/validate-instance` - Validate PDPTW instance format
- `POST /api/solve` - Solve PDPTW problem with specified algorithm
- `GET /api/sample-instance` - Get a sample instance for testing

### File Operations
- `POST /api/upload-instance` - Upload instance file
- `POST /api/upload-solution` - Upload solution file

## 🧮 Available Algorithm

**Hybrid ACO-Greedy**
- Executable: `PDPTW_HYBRID_ACO_GREEDY_V3.exe`
- Location: `visualizer/public/PDPTW_HYBRID_ACO_GREEDY_V3.exe`
- Advanced metaheuristic combining Ant Colony Optimization with greedy construction
- Highly configurable parameters for optimal performance
- Supports complex PDPTW constraints including time windows and capacity

### Algorithm Features:
- **Population-based search** with ant colony behavior
- **Greedy construction** for efficient solution building
- **Local search integration** for solution improvement
- **Elite solution management** for maintaining quality
- **Adaptive pheromone updates** for exploration/exploitation balance
- **Configurable parameters** including ants, iterations, alpha, beta, rho, and greedy bias

## 📊 Frontend Features

### Modern React.js Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Component-based Architecture**: Reusable and maintainable components
- **TailwindCSS Styling**: Modern, consistent UI design
- **Error Boundaries**: Graceful error handling
- **Loading States**: Smooth user experience with loading indicators

### Key Pages
1. **Dashboard**: System overview and quick actions
2. **Solver**: Problem configuration and algorithm execution
3. **Results**: Solution visualization and analysis
4. **About**: Documentation and algorithm information

### Enhanced UX Features
- Real-time progress tracking
- File drag-and-drop upload
- Interactive solution visualization
- Responsive notifications
- Dark mode support (planned)

## 🛠️ Development

### Backend Development

The Express.js backend uses modern ES modules and includes:

- **Security**: Helmet, CORS, rate limiting
- **File Upload**: Multer for multipart/form-data
- **Logging**: Winston for structured logging
- **Validation**: Express-validator for input validation
- **Error Handling**: Comprehensive error middleware

### Frontend Development

The React.js frontend uses:

- **Vite**: Fast build tool and development server
- **React Router**: Client-side routing
- **Axios**: HTTP client for API communication
- **React Hook Form**: Form handling and validation
- **Chart.js**: Data visualization
- **React Hot Toast**: User notifications

### Building for Production

#### Backend
```bash
cd backend
npm run build  # If build process exists
npm start      # Production server
```

#### Frontend
```bash
cd frontend-react
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🔧 Configuration

### Backend Environment Variables (.env)
```bash
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info
ALGORITHMS_FOLDER=../RELEASE
EXECUTION_TIMEOUT=300000
```

### Frontend Environment Variables
```bash
VITE_API_URL=http://localhost:5000
```

## 📈 Performance

### Backend Optimizations
- Request compression with gzip
- Rate limiting to prevent abuse
- Efficient file handling
- Background process management
- Memory usage monitoring

### Frontend Optimizations
- Code splitting with lazy loading
- Image optimization
- Bundle analysis and optimization
- Caching strategies
- Progressive loading

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test                # Run tests
npm run test:coverage  # Run with coverage
```

### Frontend Testing
```bash
cd frontend-react
npm test                # Run tests
npm run test:ui        # Interactive test UI
npm run test:coverage  # Coverage report
```

## 🚀 Deployment

### Backend Deployment
- Compatible with Node.js hosting platforms (Heroku, AWS, DigitalOcean)
- Docker support (add Dockerfile)
- PM2 for process management
- Environment-specific configurations

### Frontend Deployment
- Static hosting (Netlify, Vercel, AWS S3)
- CDN integration
- Build optimization
- Progressive Web App (PWA) ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check the logs in `backend/logs/`
2. Verify all dependencies are installed
3. Ensure algorithm executables are in `RELEASE/` folder
4. Check the console for error messages
5. Open an issue on GitHub with detailed information

## 🔄 Migration from Previous Version

If migrating from the previous Flask + vanilla JS version:

1. The API endpoints remain largely the same for compatibility
2. Algorithm executables are unchanged
3. Instance file formats are identical
4. Configuration has been modernized but functionality preserved

## 📞 Contact

For questions, suggestions, or support, please contact the development team or open an issue on GitHub.

---

**Built with ❤️ using Express.js, React.js, and TailwindCSS**

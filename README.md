# Event Evaluation System with Data-Driven Feedback Analysis

## Capstone Project for La Verdad Christian College - Apalit, Pampanga

This system implements a comprehensive event evaluation platform with data-driven feedback analysis and performance reporting, specifically designed for educational institutions.

## 🎯 System Overview

The Event Evaluation System provides:
- **Automated feedback collection** for school and program events
- **Data-driven analysis** using Python TextBlob for qualitative insights
- **Performance reporting** with comparative analysis capabilities
- **Role-based access control** for different user types
- **Real-time progress tracking** and automated notifications

## 🛠️ Technology Stack

### Backend
- **Node.js** - Server-side runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database for data storage
- **Python** - Data analysis and text processing
- **TextBlob** - Sentiment analysis and natural language processing

### Frontend
- **React.js** - User interface library
- **Tailwind CSS** - Utility-first CSS framework
- **Google Charts** - Data visualization

### Development & Deployment
- **Vite** - Frontend build tool
- **Vercel** - Frontend hosting
- **Render** - Backend hosting
- **GitHub** - Version control

## 🚀 Features

### ✅ Implemented Features

1. **User Authentication & Authorization**
   - Google Single Sign-On (SSO)
   - Role-based access control (RBAC)
   - JWT session management

2. **Survey Management**
   - Dynamic survey creation
   - Hierarchical event evaluation
   - CSV upload for existing surveys

3. **Feedback Analysis**
   - **Qualitative Analysis**: Python TextBlob sentiment analysis with **multilingual support** (English & Tagalog/Filipino)
   - **Quantitative Analysis**: Python Pandas statistical processing
   - **Language Detection**: Automatic detection of English, Tagalog, or mixed content
   - **Enhanced Sentiment Lexicon**: Custom Tagalog sentiment word database
   - Automated insights and recommendations

4. **Performance Reporting**
   - Visual report generation
   - Comparative year-over-year analysis
   - Export capabilities (PDF, CSV)
   - Automated email distribution

5. **Participant Management**
   - Attendance verification via CSV upload
   - Digital certificate generation
   - Badge-based engagement system

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (v4.4 or higher)
- **Git**

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd event-evaluation-system
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Set Up Python Environment

#### Windows
```cmd
setup_python.bat
```

#### Linux/macOS
```bash
chmod +x setup_python.sh
./setup_python.sh
```

### 4. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/event-evaluation
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 5. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📖 API Endpoints

### Analysis Routes
- `GET /api/analysis/event/:eventId/average-rating` - Get average rating
- `GET /api/analysis/event/:eventId/qualitative-report` - Get qualitative analysis
- `GET /api/analysis/event/:eventId/quantitative-report` - Get quantitative analysis

## 🧪 Testing Guide

### 🎯 Test Data Structure

**After running `npm run seed`, use these event IDs:**

**Main Event (Tech Conference 2025)**: `507f1f77bcf86cd799439011`
- **10 feedback entries** (5 English, 5 Tagalog) for comprehensive testing
- **Multilingual content** for testing language detection
- **Mixed sentiment** (positive, neutral, negative) for analysis variety
- **Perfect for testing** all API endpoints

**Historical Event (Tech Conference 2024)**: `507f1f77bcf86cd799439012`
- **4 feedback entries** for year-over-year comparison testing

### 📱 Quick Test Commands

**Test with curl:**
```bash
# Average Rating - Main Event
curl http://localhost:5000/api/analysis/event/507f1f77bcf86cd799439011/average-rating

# Qualitative Report (Multilingual) - Main Event
curl http://localhost:5000/api/analysis/event/507f1f77bcf86cd799439011/qualitative-report

# Quantitative Report - Main Event
curl http://localhost:5000/api/analysis/event/507f1f77bcf86cd799439011/quantitative-report
```

## 🔍 Usage

### For Event Organizers
1. **Create Event**: Set up event details and attendance list
2. **Design Survey**: Create custom evaluation forms or upload existing ones
3. **Monitor Progress**: Track response rates in real-time
4. **View Reports**: Access comprehensive analysis and insights

### For Administrators
1. **Review Reports**: Access performance reports and comparative analysis
2. **Export Data**: Download reports in PDF/CSV format
3. **Manage Users**: Oversee user accounts and permissions

### For Participants
1. **Complete Surveys**: Provide feedback through engaging forms
2. **Earn Recognition**: Receive digital certificates and badges

## 📊 Data Analysis Features

### Qualitative Analysis
- **Multilingual Sentiment Analysis**: Supports both English and Tagalog/Filipino text
- **Language Detection**: Automatic detection of English, Tagalog, or mixed content
- **Enhanced Sentiment Lexicon**: Custom database of Tagalog sentiment words with intensifiers
- **Text Categorization**: Positive, neutral, negative classification
- **Insight Generation**: Automated recommendations based on feedback patterns

### Quantitative Analysis
- **Statistical Processing**: Pandas-powered data aggregation
- **Trend Analysis**: Year-over-year performance comparison
- **Rating Analytics**: Average, median, standard deviation calculations
- **Multilingual Support**: Handles feedback in any language combination

### 🌍 Multilingual Capabilities

The system is specifically designed for Philippine educational institutions and supports:

- **English Text**: Full TextBlob sentiment analysis
- **Tagalog/Filipino Text**: Custom sentiment lexicon with Filipino words
- **Mixed Content**: Intelligent analysis of English-Tagalog combinations
- **Cultural Context**: Understanding of Filipino expressions and intensifiers

**Example Supported Phrases:**
- English: "This event was excellent" → Positive
- Tagalog: "Ang programa ay napakaganda" → Positive
- Mixed: "Ang event ay very good" → Positive

## 🔐 Security Features

- **Data Encryption**: HTTPS for all communications
- **Access Control**: Role-based permissions
- **Input Validation**: Comprehensive data sanitization
- **Privacy Protection**: Anonymized reporting options

## 📈 Performance Features

- **Scalability**: Horizontal scaling support
- **Caching**: Optimized database queries
- **Async Processing**: Background report generation
- **Load Balancing**: Traffic distribution management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is developed as part of a capstone project for La Verdad Christian College - Apalit, Pampanga.

## 👥 Development Team

- **Catibog, Trisha Mae B.**
- **Degula, Elloisa D.**
- **Ebajan, Rodolfo Jr. M.**
- **Pagarigan, Shaina Karillyn G.**

## 🎓 Academic Information

- **Institution**: La Verdad Christian College - Apalit, Pampanga
- **Degree**: Bachelor of Science in Information Systems
- **Instructor**: Mr. Jerreck Reynald D. Navalta, MIT
- **Completion**: June 2025

---

For technical support or questions, please contact the development team or refer to the project documentation.
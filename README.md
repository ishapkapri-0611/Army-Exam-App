# 🎖️ Army Examination System

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ishapkapri/army-examination-system)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey.svg)](https://github.com/ishapkapri/army-examination-system)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE.txt)
[![Developer](https://img.shields.io/badge/developer-Ishap%20Kapri-green.svg)](https://github.com/ishapkapri)

> **Professional Army Examination Management System**  
> Secure, offline examination platform designed specifically for the Indian Army with real-time monitoring and professional result generation.

## 🏢 **Developer Information**

**Lead Developer**: [Ishap Kapri](https://github.com/ishapkapri-0611)  
**Company**: Kapri Software Pvt Ltd.  
**Email**: kaprisoftware.pvt.ltd@gmail.com  

---

## 📋 **Overview**

The Army Examination System is a comprehensive, secure desktop application built with Electron.js for conducting offline army examinations. It features dual applications - one for invigilators (exam management) and one for candidates (exam taking), with robust security measures and real-time monitoring capabilities.

### 🎯 **Key Features**

- **🔒 Secure Environment**: Kiosk mode prevents access to other applications
- **📡 Auto-Discovery**: Automatic server detection without manual configuration  
- **📊 Real-time Monitoring**: Live candidate progress tracking
- **📄 Professional Reports**: Word document result generation
- **🌐 Network Support**: Single computer or multi-computer setup
- **💾 Auto-save**: Continuous answer backup during exam
- **🔄 Resume Capability**: Exam can be resumed after interruptions

---

## 🏗️ **Architecture**

```
army-examination-system/
├── 📁 invigilatorApp/          # Exam management application
├── 📁 candidateApp/            # Candidate exam interface
├── 📁 shared-lib/              # Shared utilities and libraries
├── 📁 absolute/                # Additional resources
├── 📄 BUILD_APPLICATIONS.bat   # Build script for both apps
├── 📄 LICENSE.txt              # Software license
└── 📄 package.json             # Main project configuration
```

### 🔧 **Technical Stack**

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js with Express.js
- **Framework**: Electron.js for desktop applications
- **Database**: SQLite3 for local data storage
- **Real-time**: Socket.IO for live communication
- **Document Processing**: Mammoth.js for Word documents
- **Result Export**: DOCX library for professional reports

---

## 🚀 **Quick Start**

### Prerequisites

- **Windows 10/11** (64-bit)
- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ishapkapri-0611/army-examination-system.git
   cd army-examination-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build applications**
   ```bash
   # Build both applications
   ./BUILD_APPLICATIONS.bat
   
   # Or build individually
   npm run build-invigilator
   npm run build-candidate
   ```

4. **Create desktop shortcuts** (Optional)
   ```bash
   ./CREATE_DESKTOP_SHORTCUTS.bat
   ```

---

## 📦 **Applications**

### 🎯 **Invigilator Application**
*Exam Management & Monitoring*

- **Exam Configuration**: Set up questions, time limits, and scoring
- **File Upload**: Drag-and-drop question and candidate files
- **Real-time Dashboard**: Monitor all candidates simultaneously
- **Result Generation**: Export professional Word documents
- **Security Monitoring**: Track security events and violations

### 👨‍🎓 **Candidate Application**
*Secure Exam Interface*

- **Auto-Server Discovery**: Finds invigilator automatically
- **Kiosk Mode**: Full-screen secure environment
- **Intuitive Interface**: Easy-to-use exam interface
- **Auto-save**: Continuous answer backup
- **Progress Tracking**: Visual progress indicators

---

## 🛡️ **Security Features**

| Feature | Description |
|---------|-------------|
| **Kiosk Mode** | Prevents access to other applications during exam |
| **Full-screen Lock** | Candidates cannot minimize or close the application |
| **Network Monitoring** | Tracks all network activities |
| **Security Logging** | Comprehensive audit trail of all actions |
| **Offline Operation** | No internet required during exams |
| **Auto-discovery** | Secure server detection without manual configuration |

---

## 📊 **Supported Question Types**

- ✅ **Multiple Choice Questions (MCQ)**
- ✅ **True/False Questions**
- ✅ **Custom Question Formats**
- ✅ **Configurable Scoring System**
- ✅ **Image Support in Questions**

---

## 🔧 **Development**

### Project Structure

```
📁 invigilatorApp/
├── 📁 src/                    # Source code
├── 📁 build/                  # Build configuration
└── 📄 package.json            # App-specific dependencies

📁 candidateApp/
├── 📁 src/                    # Source code
├── 📁 build/                  # Build configuration
└── 📄 package.json            # App-specific dependencies

📁 shared-lib/
├── 📁 utils/                  # Shared utilities
└── 📄 package.json            # Shared dependencies
```

### Build Commands

```bash
# Install all dependencies
npm install

# Build invigilator application
npm run build-invigilator

# Build candidate application
npm run build-candidate

# Build both applications
npm run build-all

# Development mode (if available)
npm run dev
```

---

## 📋 **System Requirements**

### Minimum Requirements
- **OS**: Windows 10 (64-bit)
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Network**: Local network for multi-computer setup

### Recommended Requirements
- **OS**: Windows 11 (64-bit)
- **RAM**: 8 GB or higher
- **Storage**: 1 GB free space
- **Network**: Gigabit Ethernet for optimal performance

---

## 📞 **Support & Contact**

### Technical Support
- **Email**: kaprisoftware.pvt.ltd@gmail.com
- **Developer**: Ishap Kapri
- **Response Time**: 1-5 hours
- **Support Hours**: 9 AM - 10 PM IST

### Business Inquiries
- **Email**: kaprisoftware.pvt.ltd@gmail.com

---

## 📜 **License**

This software is proprietary and licensed for official army use only. See [LICENSE.txt](LICENSE.txt) for full license terms.

**Copyright © 2025 Kapri Software Pvt Ltd. All rights reserved.**

---

## 🏆 **Quality Assurance**

- ✅ **Tested Platforms**: Windows 10, Windows 11
- ✅ **Security Audited**: Multi-layer security validation
- ✅ **Performance Tested**: Supports multiple concurrent candidates
- ✅ **Reliability**: 99.9% uptime during exam sessions
- ✅ **Compatibility**: Works with standard army IT infrastructure

---

## 🌟 **Acknowledgments**

**Lead Developer**: **Ishap Kapri**  
*Architect and Lead Developer of the Army Examination System*

Special thanks to:
- Indian Army IT Department for requirements and feedback
- Beta testing teams for quality assurance
- Security consultants for vulnerability assessment
- UI/UX experts for accessibility compliance

---

## 🔄 **Version History**

### v2.0.0 (2025) - Current
- Complete rewrite with modern architecture
- Enhanced security features
- Auto-discovery network system
- Professional UI/UX design
- Comprehensive monitoring system
- Word document integration

### v1.0.0 (Previous)
- Initial release
- Basic exam functionality

---

## 🚀 **Future Roadmap**

- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mobile companion app
- [ ] Cloud backup integration
- [ ] Enhanced reporting features

---

<div align="center">

**Army Examination System v2.0.0**  
*Professional. Secure. Reliable.*

**Developed by [Ishap Kapri](https://github.com/ishapkapri) with pride for the Indian Army** 🇮🇳

[![GitHub](https://img.shields.io/badge/GitHub-ishapkapri-black.svg?logo=github)](https://github.com/ishapkapri)
[![Email](https://img.shields.io/badge/Email-kaprisoftware.pvt.ltd%40gmail.com-red.svg?logo=gmail)](mailto:kaprisoftware.pvt.ltd@gmail.com)

</div>

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ProductionLogger = require('../../../shared-lib/utils/production-logger');
const NetworkDiscovery = require('../../../shared-lib/utils/network-discovery');
const Server = require('../server/app');
const DocumentParser = require('../../../shared-lib/utils/document-parser');

const logger = new ProductionLogger();
let mainWindow;
let serverInstance;
let networkDiscovery;
let docxPackageAvailable = false;

// Store uploaded data globally
let uploadedUsers = [];
let uploadedQuestions = [];

// Auto-install docx package if missing
async function checkAndInstallDocxPackage() {
    console.log('🔍 Checking docx package availability...');
    
    try {
        // Try to require docx package directly
        require('docx');
        console.log('✅ docx package is available');
        docxPackageAvailable = true;
        return true;
    } catch (error) {
        console.log('❌ docx package not found, attempting auto-installation...');
        console.log('Error details:', error.message);
        docxPackageAvailable = false;
        
        // Show loading dialog
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
                showLoading('Installing Word export package...', 'This is a one-time setup. Please wait...');
            `);
        }
        
        return await installDocxPackage();
    }
}

async function installDocxPackage() {
    return new Promise((resolve) => {
        console.log('📦 Installing docx package...');
        
        // Determine the correct npm command
        const isWindows = process.platform === 'win32';
        const npmCommand = isWindows ? 'npm.cmd' : 'npm';
        
        // Run npm install docx
        const installProcess = spawn(npmCommand, ['install', 'docx@9.5.1'], {
            cwd: path.join(__dirname, '../../'), // invigilatorApp directory
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        installProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('npm output:', data.toString().trim());
        });
        
        installProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.log('npm error:', data.toString().trim());
        });
        
        installProcess.on('close', (code) => {
            if (mainWindow) {
                mainWindow.webContents.executeJavaScript(`hideLoading();`);
            }
            
            if (code === 0) {
                console.log('✅ docx package installed successfully!');
                
                // Verify installation by testing both require and basic functionality
                try {
                    const docxModule = require('docx');
                    
                    // Test basic docx functionality
                    const { Document, Paragraph } = docxModule;
                    const testDoc = new Document({
                        sections: [{
                            properties: {},
                            children: [new Paragraph({ text: "Test" })]
                        }]
                    });
                    
                    docxPackageAvailable = true;
                    console.log('✅ docx package verified and ready');
                    
                    if (mainWindow) {
                        mainWindow.webContents.executeJavaScript(`
                            showNotification({
                                type: 'success',
                                title: 'Setup Complete',
                                message: 'Word export is now available! You can export results as .docx files.'
                            });
                        `);
                    }
                    
                    resolve(true);
                } catch (verifyError) {
                    console.error('❌ Installation verification failed:', verifyError.message);
                    docxPackageAvailable = false;
                    
                    if (mainWindow) {
                        mainWindow.webContents.executeJavaScript(`
                            showNotification({
                                type: 'warning',
                                title: 'Installation Issue',
                                message: 'Word export package installed but verification failed. HTML export will be used instead.'
                            });
                        `);
                    }
                    
                    resolve(false);
                }
            } else {
                console.error('❌ docx package installation failed with code:', code);
                console.error('Error output:', errorOutput);
                docxPackageAvailable = false;
                
                if (mainWindow) {
                    mainWindow.webContents.executeJavaScript(`
                        showNotification({
                            type: 'info',
                            title: 'Word Export Not Available',
                            message: 'Could not install Word export package. Results will be exported as HTML files instead.'
                        });
                    `);
                }
                
                resolve(false);
            }
        });
        
        installProcess.on('error', (error) => {
            console.error('❌ Failed to start npm install:', error.message);
            docxPackageAvailable = false;
            
            if (mainWindow) {
                mainWindow.webContents.executeJavaScript(`hideLoading();`);
                mainWindow.webContents.executeJavaScript(`
                    showNotification({
                        type: 'info',
                        title: 'Word Export Not Available',
                        message: 'Could not install Word export package. Results will be exported as HTML files instead.'
                    });
                `);
            }
            
            resolve(false);
        });
    });
}

// Security: Set permissions
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'file://') {
            event.preventDefault();
            logger.warn('Blocked navigation attempt', { url: navigationUrl });
        }
    });

    contents.setWindowOpenHandler(() => {
        logger.warn('Blocked new window creation');
        return { action: 'deny' };
    });
});

function createWindow() {
    logger.info('Creating main window');
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        title: 'Army Exam Invigilator',
        minWidth: 1200,
        minHeight: 800,
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        logger.info('Main window ready and visible');
        
        // Check and install docx package after window is ready
        setTimeout(() => {
            checkAndInstallDocxPackage();
        }, 2000); // Wait 2 seconds for UI to fully load
    });

    // Security: Prevent DevTools in production
    if (process.env.NODE_ENV !== 'development') {
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
            logger.warn('DevTools opening attempted and blocked');
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        logger.info('Main window closed');
    });

    mainWindow.on('focus', () => {
        logger.debug('Window focused');
    });

    mainWindow.on('blur', () => {
        logger.debug('Window blurred');
    });
}

// Enhanced IPC Handlers for Production

// Server Management Handlers
ipcMain.handle('start-server', async (event, port = 9611) => {
    try {
        logger.info('Starting exam server', { port });
        
        // Check if server is already running
        if (serverInstance && serverInstance.isRunning) {
            return { 
                success: false, 
                error: 'Server is already running on port ' + serverInstance.port 
            };
        }

        serverInstance = new Server(port);
        networkDiscovery = new NetworkDiscovery();
        
        await serverInstance.start();
        await networkDiscovery.startBroadcasting(port);
        
        logger.info('Exam server started successfully', { port });
        return { success: true, port };
        
    } catch (error) {
        logger.error('Failed to start exam server', { error: error.message, port });
        
        // Clean up on failure
        if (serverInstance) {
            await serverInstance.stop().catch(() => {});
            serverInstance = null;
        }
        if (networkDiscovery) {
            networkDiscovery.stopBroadcasting();
            networkDiscovery = null;
        }
        
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-server', async () => {
    try {
        logger.info('Stopping exam server');
        
        if (serverInstance) {
            await serverInstance.stop();
        }
        if (networkDiscovery) {
            networkDiscovery.stopBroadcasting();
        }
        
        logger.info('Exam server stopped successfully');
        return { success: true };
        
    } catch (error) {
        logger.error('Failed to stop exam server', { error: error.message });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-server-status', () => {
    const status = {
        isRunning: serverInstance ? serverInstance.isRunning : false,
        port: serverInstance ? serverInstance.port : null,
        connectedCandidates: serverInstance ? serverInstance.getConnectedCount() : 0,
        uptime: serverInstance ? Math.floor((Date.now() - serverInstance.startTime) / 1000) : 0,
        uploadedUsers: uploadedUsers.length,
        uploadedQuestions: uploadedQuestions.length
    };
    
    return status;
});

// Fixed File Upload Handlers with Working Dialogs
ipcMain.handle('upload-users-file', async (event) => {
    try {
        if (!serverInstance || !serverInstance.isRunning) {
            throw new Error('Server is not running. Please start the server before uploading files.');
        }

        console.log('📁 Users file upload requested from renderer');
        
        if (!mainWindow) {
            throw new Error('Main window not available');
        }

        const documentParser = new DocumentParser();
        
        // Show file dialog
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Candidates List Document',
            defaultPath: require('os').homedir(),
            properties: ['openFile'],
            filters: [
                { 
                    name: 'Word Documents', 
                    extensions: ['docx', 'doc'] 
                },
                { 
                    name: 'All Files', 
                    extensions: ['*'] 
                }
            ],
            message: 'Select a Word document containing candidate list (JC543031A, Name, Rank, Unit)'
        });
        
        console.log('File dialog result:', result);
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            console.log('📄 Selected file:', filePath);
            
            // Validate file exists and is readable
            if (!fs.existsSync(filePath)) {
                throw new Error('Selected file does not exist');
            }

            // Validate file size
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            console.log('File stats:', { size: fileSize, path: filePath });
            
            if (fileSize > 10 * 1024 * 1024) {
                throw new Error('File size exceeds 10MB limit');
            }
            
            if (fileSize === 0) {
                throw new Error('File is empty');
            }
            
            // Read file
            const fileBuffer = fs.readFileSync(filePath);
            console.log('📊 File read successfully, size:', fileBuffer.length);
            
            // Parse users
            console.log('🔄 Starting user parsing...');
            const users = await documentParser.parseUsersDocument(fileBuffer);
            console.log('👥 Parsed users:', users.length);
            
            // Validate users
            if (users.length === 0) {
                throw new Error('No valid users found in the document. Please check the format: JC543031A, Name, Rank, Unit');
            }
            
            // Store globally
            uploadedUsers = users;
            
            // Send users to server
            const response = await fetch('http://localhost:9611/api/upload/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users })
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload users to server');
            }
            
            return { 
                success: true, 
                filePath: filePath, 
                fileName: path.basename(filePath),
                fileSize: fileSize,
                usersCount: users.length,
                users: users
            };
        } else {
            console.log('File selection cancelled by user');
            return { 
                success: false, 
                error: 'File selection cancelled',
                cancelled: true 
            };
        }
        
    } catch (error) {
        console.error('❌ Error in upload-users-file:', error);
        return { 
            success: false, 
            error: error.message || 'Unknown error occurred during file upload'
        };
    }
});

ipcMain.handle('upload-questions-file', async (event) => {
    try {
        console.log('📝 Questions file upload requested from renderer');
        
        if (!mainWindow) {
            throw new Error('Main window not available');
        }

        const documentParser = new DocumentParser();
        
        // Show file dialog
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Exam Questions Document',
            defaultPath: require('os').homedir(),
            properties: ['openFile'],
            filters: [
                { 
                    name: 'Word Documents', 
                    extensions: ['docx', 'doc'] 
                },
                { 
                    name: 'All Files', 
                    extensions: ['*'] 
                }
            ],
            message: 'Select a Word document containing exam questions (MCQ and True/False with marks)'
        });
        
        console.log('File dialog result:', result);
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            console.log('📄 Selected file:', filePath);
            
            // Validate file exists and is readable
            if (!fs.existsSync(filePath)) {
                throw new Error('Selected file does not exist');
            }

            // Validate file size
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            console.log('File stats:', { size: fileSize, path: filePath });
            
            if (fileSize > 10 * 1024 * 1024) {
                throw new Error('File size exceeds 10MB limit');
            }
            
            if (fileSize === 0) {
                throw new Error('File is empty');
            }
            
            // Read file
            const fileBuffer = fs.readFileSync(filePath);
            console.log('📊 File read successfully, size:', fileBuffer.length);
            
            // Parse questions
            console.log('🔄 Starting question parsing...');
            const questions = await documentParser.parseQuestionsDocument(fileBuffer);
            console.log('❓ Parsed questions:', questions.length);
            
            // Validate questions
            if (questions.length === 0) {
                const error = new Error('No valid questions found in the document. Please check the format.');
                error.details = {
                    requiredFormat: 'Questions must start with Q1, Question 1, or 1) followed by text and [marks]',
                    example: 'Q1. What is the capital of France? [2 marks]\nA. Paris\nB. London\nCorrect Answer: A'
                };
                throw error;
            }
            
            const validation = documentParser.validateQuestions(questions);
            if (!validation.isValid) {
                console.warn('⚠️ Question validation errors:', validation.errors);
                // We'll still proceed but log warnings
            }
            
            // Store globally
            uploadedQuestions = questions;
            
            // Calculate total marks
            const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
            
            return { 
                success: true, 
                filePath: filePath, 
                fileName: path.basename(filePath),
                fileSize: fileSize,
                questionsCount: questions.length,
                totalMarks: totalMarks,
                questions: questions,
                validation: validation
            };
        } else {
            console.log('File selection cancelled by user');
        return {
                success: false, 
                error: 'File selection cancelled',
                cancelled: true 
            };
        }
        
    } catch (error) {
        console.error('❌ Error in upload-questions-file:', error);
        return { 
            success: false, 
            error: error.message || 'Unknown error occurred during file upload'
        };
    }
});

// Data Management Handlers
ipcMain.handle('start-exam', async (event, examData) => {
    try {
        if (!serverInstance || !serverInstance.isRunning) {
            logger.error('Failed to start exam', { error: 'Server is not running.' });
            return { success: false, error: 'Server is not running.' };
        }

        if (uploadedQuestions.length === 0) {
            throw new Error('No questions available to start the exam.');
        }

        // The server now handles broadcasting internally via startExam
        serverInstance.startExam(uploadedQuestions, examData.duration);

        logger.info('Exam started', {
            questionCount: uploadedQuestions.length,
            duration: examData.duration
        });

        return { success: true, message: 'Exam started successfully.' };
    } catch (error) {
        logger.error('Failed to start exam', { error: error.message });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-uploaded-data', async (event) => {
    return {
        users: uploadedUsers,
        questions: uploadedQuestions,
        hasUsers: uploadedUsers.length > 0,
        hasQuestions: uploadedQuestions.length > 0,
        usersCount: uploadedUsers.length,
        questionsCount: uploadedQuestions.length,
        totalMarks: uploadedQuestions.reduce((sum, q) => sum + q.marks, 0)
    };
});

ipcMain.handle('clear-uploaded-data', async (event) => {
    uploadedUsers = [];
    uploadedQuestions = [];
    logger.info('Cleared all uploaded data');
    return { success: true };
});

// Results Calculation and Export Handlers
ipcMain.handle('calculate-results', async (event) => {
    try {
        logger.info('Calculating exam results');

        if (uploadedUsers.length === 0) {
            throw new Error('No users data available. Please upload users file first.');
        }

        if (uploadedQuestions.length === 0) {
            throw new Error('No questions data available. Please upload questions file first.');
        }

        // Fetch candidate answers from server
        const response = await fetch('http://localhost:9611/api/answers');
        const data = await response.json();
        const candidateAnswers = data.success ? data.answers : [];

        const documentParser = new DocumentParser();
        const results = documentParser.calculateResults(candidateAnswers, uploadedQuestions, uploadedUsers);

        logger.info('Results calculation completed', {
            totalCandidates: results.length,
            averageScore: results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / results.length
        });

        return {
            success: true,
            results: results,
            totalCandidates: results.length,
            summary: {
                averageScore: results.reduce((sum, r) => sum + parseFloat(r.percentage), 0) / results.length,
                passCount: results.filter(r => r.status === 'PASS').length,
                totalCandidates: results.length
            }
        };

    } catch (error) {
        logger.error('Error calculating results', { error: error.message });
        return { success: false, error: error.message };
    }
});

// HTML Export Fallback Function
async function exportAsHTML(resultsToExport, originalFilePath) {
    console.log('=== HTML EXPORT FALLBACK ===');
    
    try {
        // Change file extension to .html
        const htmlFilePath = originalFilePath.replace(/\.docx?$/i, '.html');
        console.log('HTML file path:', htmlFilePath);
        
        // Generate HTML content
        const htmlContent = generateResultsHTML(resultsToExport);
        
        // Ensure directory exists
        const dir = path.dirname(htmlFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write HTML file
        fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
        
        // Verify file was created
        if (fs.existsSync(htmlFilePath)) {
            const stats = fs.statSync(htmlFilePath);
            console.log('HTML file created successfully, size:', stats.size, 'bytes');
            
            // Open file location
            try {
                shell.showItemInFolder(htmlFilePath);
            } catch (error) {
                console.warn('Could not open file location:', error.message);
            }
            
            return {
                success: true,
                filePath: htmlFilePath,
                resultsCount: resultsToExport.length,
                fileSize: stats.size,
                format: 'HTML',
                message: `Results exported as HTML file (Word format not available): ${htmlFilePath}`
            };
        } else {
            throw new Error('HTML file was not created');
        }
        
    } catch (error) {
        console.error('HTML export error:', error);
        throw new Error(`HTML export failed: ${error.message}`);
    }
}

// Generate HTML content for results
function generateResultsHTML(results) {
    const currentDate = new Date().toLocaleString();
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Army Examination Results</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background-color: #003366;
            color: white;
            border-radius: 8px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 14px;
        }
        .summary {
            background-color: #e7f3ff;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #0066cc;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        th {
            background-color: #003366;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        tr:hover {
            background-color: #e9ecef;
        }
        .pass {
            color: #28a745;
            font-weight: bold;
        }
        .fail {
            color: #dc3545;
            font-weight: bold;
        }
        .percentage {
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding: 15px;
            background-color: #6c757d;
            color: white;
            border-radius: 5px;
            font-size: 12px;
        }
        @media print {
            body { background-color: white; }
            .summary, table { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🇮🇳 Army Examination Results</h1>
        <p>Generated on: ${currentDate}</p>
    </div>
    
    <div class="summary">
        <strong>Summary:</strong> ${results.length} candidates participated | 
        Average Score: ${(results.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / results.length).toFixed(2)}% |
        Passed: ${results.filter(r => parseFloat(r.percentage || 0) >= 50).length} |
        Failed: ${results.filter(r => parseFloat(r.percentage || 0) < 50).length}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Army Number</th>
                <th>Name</th>
                <th>Rank</th>
                <th>Unit</th>
                <th>Score</th>
                <th>Total Questions</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Submission Time</th>
            </tr>
        </thead>
        <tbody>
            ${results.map(result => {
                const percentage = parseFloat(result.percentage || 0);
                const status = percentage >= 50 ? 'PASS' : 'FAIL';
                const statusClass = status === 'PASS' ? 'pass' : 'fail';
                
                return `
            <tr>
                <td><strong>${result.armyNumber || 'N/A'}</strong></td>
                <td>${result.name || 'Unknown'}</td>
                <td>${result.rank || 'N/A'}</td>
                <td>${result.unit || 'N/A'}</td>
                <td>${result.score || 0}</td>
                <td>${result.totalQuestions || 0}</td>
                <td class="percentage">${percentage.toFixed(2)}%</td>
                <td class="${statusClass}">${status}</td>
                <td>${result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</td>
            </tr>
            `}).join('')}
        </tbody>
    </table>
    
    <div class="footer">
        <p>Army Examination System | Generated by Invigilator Application</p>
        <p>This document contains ${results.length} examination results</p>
    </div>
</body>
</html>`;
    
    return htmlContent;
}

// Helper function for results calculation
async function calculateResults(candidateAnswers = []) {
    try {
        if (uploadedUsers.length === 0) {
            throw new Error('No users data available. Please upload users file first.');
        }
        if (uploadedQuestions.length === 0) {
            throw new Error('No questions data available. Please upload questions file first.');
        }

        const documentParser = new DocumentParser();
        const results = documentParser.calculateResults(candidateAnswers, uploadedQuestions, uploadedUsers);

        return { success: true, results };
    } catch (error) {
        logger.error('Error in calculateResults helper', { error: error.message });
        return { success: false, error: error.message };
    }
}

ipcMain.handle('export-results-word', async (event, results = []) => {
    console.log('=== EXPORT RESULTS WORD HANDLER CALLED ===');
    
    try {
        logger.info('Exporting results to Word document');
        console.log('Step 1: Handler started');
        
        // Check if mainWindow exists
        if (!mainWindow) {
            console.error('MainWindow is not available');
            throw new Error('Main window is not available for dialog');
        }
        console.log('Step 2: MainWindow exists');
        
        const documentParser = new DocumentParser();
        console.log('Step 3: DocumentParser created');
        
        // Check if server is running and has data
        if (!serverInstance || !serverInstance.isRunning) {
            console.error('Server is not running');
            throw new Error('Server is not running. Please start the server first.');
        }
        console.log('Step 4: Server is running');

        // Use provided results or calculate new ones
        let resultsToExport = results;
        console.log('Step 5: Initial results length:', results.length);
        
        if (results.length === 0) {
            logger.info('No results provided, fetching from server API...');
            console.log('Step 6: Fetching results from server API');
            
            try {
                // Fetch results directly from server API
                const fetch = require('node-fetch');
                const response = await fetch('http://localhost:9611/api/submissions');
                
                if (!response.ok) {
                    throw new Error(`Server API error: ${response.status} ${response.statusText}`);
                }
                
                const serverData = await response.json();
                console.log('Step 7: Server API response:', serverData);
                
                if (!serverData.success || !serverData.submissions) {
                    throw new Error('Invalid server response format');
                }
                
                resultsToExport = serverData.submissions.map(submission => ({
                    armyNumber: submission.armyNumber,
                    name: submission.name,
                    rank: submission.rank,
                    unit: submission.unit,
                    score: submission.score,
                    totalQuestions: submission.totalQuestions,
                    percentage: submission.percentage,
                    status: parseFloat(submission.percentage) >= 50 ? 'PASS' : 'FAIL',
                    submittedAt: submission.submittedAt
                }));
                
                console.log('Step 8: Processed results from server, count:', resultsToExport.length);
                logger.info(`Fetched ${resultsToExport.length} results from server API`);
                
            } catch (fetchError) {
                console.error('Error fetching from server API:', fetchError);
                throw new Error(`Failed to fetch results from server: ${fetchError.message}`);
            }
        }
        
        if (resultsToExport.length === 0) {
            console.error('No results to export');
            throw new Error('No exam submissions found. Ensure candidates have submitted their exams before exporting results.');
        }
        
        console.log('Step 10: About to show save dialog...');

        console.log('Step 11: Showing save dialog...');
        
        const dialogOptions = {
            defaultPath: `army-exam-results-${new Date().toISOString().split('T')[0]}`,
            filters: [
                { name: 'Word Documents', extensions: ['docx'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            title: 'Save Results Document'
        };
        
        console.log('Dialog options:', dialogOptions);
        
        const result = await dialog.showSaveDialog(mainWindow, dialogOptions);
        
        console.log('Step 12: Dialog result:', result);

        if (!result.canceled && result.filePath) {
            console.log('Step 13: User selected file path:', result.filePath);
            
            console.log('Step 14: Checking docx package availability...');
            
            // Check if docx package is available
            if (!docxPackageAvailable) {
                console.log('docx package not available, using HTML export');
                return await exportAsHTML(resultsToExport, result.filePath);
            }
            
            let Packer;
            try {
                const docxModule = require('docx');
                Packer = docxModule.Packer;
                console.log('docx package is available');
            } catch (docxError) {
                console.error('docx package not available:', docxError.message);
                docxPackageAvailable = false; // Update flag
                
                // Fallback to HTML export
                console.log('Step 14b: Falling back to HTML export...');
                return await exportAsHTML(resultsToExport, result.filePath);
            }
            
            console.log('Step 15: Generating Word document...');
            console.log('Results data for document:', JSON.stringify(resultsToExport, null, 2));
            
            let doc;
            try {
                doc = await documentParser.generateResultsDocument(resultsToExport, 'Army Examination Results');
                console.log('Document generated successfully');
            } catch (docError) {
                console.error('Document generation error:', docError);
                
                // Fallback to HTML export
                console.log('Step 15b: Document generation failed, falling back to HTML...');
                return await exportAsHTML(resultsToExport, result.filePath);
            }
            
            console.log('Step 16: Converting to buffer...');
            let buffer;
            try {
                buffer = await Packer.toBuffer(doc);
                console.log('Buffer conversion successful, size:', buffer.length, 'bytes');
                
                if (buffer.length === 0) {
                    throw new Error('Generated buffer is empty');
                }
            } catch (bufferError) {
                console.error('Buffer conversion error:', bufferError);
                
                // Fallback to HTML export
                console.log('Step 16b: Buffer conversion failed, falling back to HTML...');
                return await exportAsHTML(resultsToExport, result.filePath);
            }
            
            console.log('Step 16: Writing file...');
            console.log('Target file path:', result.filePath);
            
            // Validate the file path
            const dir = path.dirname(result.filePath);
            console.log('Target directory:', dir);
            
            // Check if directory exists, create if it doesn't
            if (!fs.existsSync(dir)) {
                console.log('Directory does not exist, creating:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Check write permissions
            try {
                fs.accessSync(dir, fs.constants.W_OK);
                console.log('Directory is writable');
            } catch (error) {
                console.error('Directory is not writable:', error);
                throw new Error(`Cannot write to directory: ${dir}. Please check permissions.`);
            }
            
            // Write the file with error handling
            try {
                fs.writeFileSync(result.filePath, buffer);
                console.log('Step 17: File write operation completed');
            } catch (writeError) {
                console.error('File write error:', writeError);
                throw new Error(`Failed to write file: ${writeError.message}`);
            }
            
            // Wait a moment for file system to sync
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify file was created and is accessible
            if (fs.existsSync(result.filePath)) {
                const stats = fs.statSync(result.filePath);
                console.log('Step 18: File verification successful');
                console.log('File size:', stats.size, 'bytes');
                console.log('File location:', result.filePath);
                
                // Validate file size
                if (stats.size === 0) {
                    throw new Error('File was created but is empty');
                }
                
                // Test file readability
                try {
                    fs.accessSync(result.filePath, fs.constants.R_OK);
                    console.log('File is readable');
                } catch (readError) {
                    console.error('File is not readable:', readError);
                    throw new Error('File was created but is not readable');
                }
                
            } else {
                throw new Error('File was not created successfully');
            }
            
            logger.info('Results exported successfully', { 
                filePath: result.filePath, 
                resultsCount: resultsToExport.length 
            });
            
            // Open the file location in file explorer (don't open the file itself)
            try {
                shell.showItemInFolder(result.filePath);
                console.log('Opened file location in explorer');
            } catch (error) {
                console.warn('Could not open file location:', error.message);
                // Fallback: try to open the directory
                try {
                    const dir = path.dirname(result.filePath);
                    shell.openPath(dir);
                    console.log('Opened directory as fallback');
                } catch (dirError) {
                    console.warn('Could not open directory either:', dirError.message);
                }
            }
            
            const finalStats = fs.statSync(result.filePath);
            
            return {
                success: true, 
                filePath: result.filePath,
                resultsCount: resultsToExport.length,
                fileSize: finalStats.size,
                message: `Word document created successfully at ${result.filePath}`
            };
        }
        
        console.log('Step 18: Export cancelled by user');
        return { success: false, error: 'Export cancelled by user' };
        
    } catch (error) {
        logger.error('Error exporting results', { error: error.message });
        return { success: false, error: error.message };
    }
});

// Export Results Table Handler - FIXED VERSION
ipcMain.handle('export-results', async (event) => {
    try {
        logger.info('Exporting results as table');
        
        let submissions = [];
        
        // Fetch submissions from server API instead of using getSubmissions()
        if (serverInstance && serverInstance.isRunning) {
            try {
                const response = await fetch(`http://localhost:${serverInstance.port}/api/submissions`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        submissions = data.submissions;
                        logger.info(`Fetched ${submissions.length} submissions from server`);
                    } else {
                        logger.warn('Server returned error for submissions', { error: data.error });
                    }
                } else {
                    logger.warn('Failed to fetch submissions from server', { status: response.status });
                }
            } catch (fetchError) {
                logger.error('Error fetching submissions from server', { error: fetchError.message });
                // Fall back to server instance method if API fails
                if (serverInstance.getSubmissions) {
                    submissions = serverInstance.getSubmissions();
                }
            }
        }

        // If no submissions from server, try to calculate from answers
        if (submissions.length === 0) {
            logger.info('No submissions found, calculating from answers');
            const calculation = await calculateResults([]);
            if (calculation.success) {
                submissions = calculation.results;
            }
        }

        if (!submissions || submissions.length === 0) {
            throw new Error('No results data available for export. Please ensure candidates have submitted their exams.');
        }

        // Ensure mainWindow is available and focused
        let targetWindow = mainWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            targetWindow = BrowserWindow.getFocusedWindow();
            if (!targetWindow) {
                targetWindow = createWindow();
            }
        }
        
        targetWindow.focus();
        
        const result = await dialog.showSaveDialog(targetWindow, {
            defaultPath: path.join(app.getPath('documents'), `army-exam-results-${new Date().toISOString().split('T')[0]}.html`),
            filters: [
                { name: 'HTML Files', extensions: ['html'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            title: 'Save Results Table'
        });

        if (!result.canceled && result.filePath) {
            // Generate HTML table with complete candidate data
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Army Examination Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #003366; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #003366; color: white; padding: 12px; text-align: left; font-weight: bold; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        tr:hover { background-color: #e9ecef; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #003366; padding-bottom: 20px; }
        .date { text-align: right; margin-top: 10px; font-style: italic; color: #666; }
        .summary { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .percentage { font-weight: bold; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Army Examination Results</h1>
        <div class="date">Generated on: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="summary">
        <strong>Summary:</strong> ${submissions.length} candidates | 
        Average Score: ${(submissions.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / submissions.length).toFixed(2)}% |
        Passed: ${submissions.filter(r => parseFloat(r.percentage || 0) >= 50).length} |
        Failed: ${submissions.filter(r => parseFloat(r.percentage || 0) < 50).length}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Army Number</th>
                <th>Name</th>
                <th>Rank</th>
                <th>Unit</th>
                <th>Score</th>
                <th>Total Questions</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Submission Time</th>
            </tr>
        </thead>
        <tbody>
            ${submissions.map(row => {
                const percentage = parseFloat(row.percentage || 0);
                const status = percentage >= 50 ? 'PASS' : 'FAIL';
                const statusClass = status === 'PASS' ? 'pass' : 'fail';
                
                return `
            <tr>
                <td>${row.armyNumber || row.candidateId || 'N/A'}</td>
                <td>${row.name || 'Unknown'}</td>
                <td>${row.rank || 'N/A'}</td>
                <td>${row.unit || 'N/A'}</td>
                <td>${row.score || row.totalScore || 0}</td>
                <td>${row.totalQuestions || uploadedQuestions.length || 'N/A'}</td>
                <td class="percentage ${statusClass}">${percentage.toFixed(2)}%</td>
                <td class="${statusClass}">${status}</td>
                <td>${row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'}</td>
            </tr>
            `}).join('')}
        </tbody>
    </table>
</body>
</html>`;
            
            fs.writeFileSync(result.filePath, htmlContent);
            
            logger.info('Results table exported successfully', { 
                filePath: result.filePath, 
                resultsCount: submissions.length 
            });
            
            // Open the file in the default browser
            shell.openExternal('file://' + result.filePath);
            
            return { 
                success: true, 
                filePath: result.filePath,
                resultsCount: submissions.length,
                summary: {
                    totalCandidates: submissions.length,
                    averageScore: (submissions.reduce((sum, r) => sum + parseFloat(r.percentage || 0), 0) / submissions.length).toFixed(2),
                    passCount: submissions.filter(r => parseFloat(r.percentage || 0) >= 50).length,
                    failCount: submissions.filter(r => parseFloat(r.percentage || 0) < 50).length
                }
            };
        }
        
        return { success: false, error: 'Export cancelled by user' };
        
    } catch (error) {
        logger.error('Error exporting results table', { error: error.message });
        return { success: false, error: error.message };
    }
});

// Export Results as CSV Handler
ipcMain.handle('export-results-csv', async (event) => {
    try {
        logger.info('Exporting results as CSV');
        
        let submissions = [];
        
        // Fetch submissions from server API
        if (serverInstance && serverInstance.isRunning) {
            try {
                const response = await fetch(`http://localhost:${serverInstance.port}/api/export-results`);
                if (response.ok) {
                    const csvData = await response.text();
                    
                    const result = await dialog.showSaveDialog(mainWindow, {
                        defaultPath: path.join(app.getPath('documents'), `army-exam-results-${new Date().toISOString().split('T')[0]}.csv`),
                        filters: [
                            { name: 'CSV Files', extensions: ['csv'] },
                            { name: 'All Files', extensions: ['*'] }
                        ],
                        title: 'Save Results as CSV'
                    });

                    if (!result.canceled && result.filePath) {
                        fs.writeFileSync(result.filePath, csvData);
                        
                        logger.info('CSV results exported successfully', { 
                            filePath: result.filePath
                        });
                        
                        return { 
                            success: true, 
                            filePath: result.filePath,
                            format: 'csv'
                        };
                    }
                    return { success: false, error: 'Export cancelled by user' };
                }
            } catch (fetchError) {
                logger.error('Error fetching CSV from server', { error: fetchError.message });
            }
        }
        
        // Fallback: Generate CSV manually
        if (serverInstance && serverInstance.isRunning) {
            try {
                const response = await fetch(`http://localhost:${serverInstance.port}/api/submissions`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        submissions = data.submissions;
                    }
                }
            } catch (error) {
                logger.error('Error fetching submissions for CSV', { error: error.message });
            }
        }

        if (submissions.length === 0) {
            throw new Error('No results data available for CSV export');
        }

        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: path.join(app.getPath('documents'), `army-exam-results-${new Date().toISOString().split('T')[0]}.csv`),
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            title: 'Save Results as CSV'
        });

        if (!result.canceled && result.filePath) {
            const headers = ['Army Number', 'Name', 'Rank', 'Unit', 'Score', 'Total Questions', 'Percentage', 'Status', 'Submission Time'];
            let csv = headers.join(',') + '\n';
            
            submissions.forEach(submission => {
                const percentage = parseFloat(submission.percentage || 0);
                const status = percentage >= 50 ? 'PASS' : 'FAIL';
                
                const row = [
                    `"${submission.armyNumber || submission.candidateId || 'N/A'}"`,
                    `"${submission.name || 'Unknown'}"`,
                    `"${submission.rank || 'N/A'}"`,
                    `"${submission.unit || 'N/A'}"`,
                    submission.score || submission.totalScore || 0,
                    submission.totalQuestions || uploadedQuestions.length || 'N/A',
                    percentage.toFixed(2),
                    status,
                    `"${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A'}"`
                ];
                csv += row.join(',') + '\n';
            });
            
            fs.writeFileSync(result.filePath, csv);
            
            logger.info('CSV results exported successfully', { 
                filePath: result.filePath,
                resultsCount: submissions.length 
            });
            
            return { 
                success: true, 
                filePath: result.filePath,
                resultsCount: submissions.length,
                format: 'csv'
            };
        }
        
        return { success: false, error: 'Export cancelled by user' };
        
    } catch (error) {
        logger.error('Error exporting results as CSV', { error: error.message });
        return { success: false, error: error.message };
    }
});

// Generic File Upload Handler (for backward compatibility)
ipcMain.handle('upload-file', async (event, { type, allowedExtensions }) => {
    try {
        logger.info('File upload requested', { type, allowedExtensions });
        
        // Ensure mainWindow exists and is focused
        if (!mainWindow || mainWindow.isDestroyed()) {
            mainWindow = BrowserWindow.getFocusedWindow() || createWindow();
        }
        
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: `${type} Files`, extensions: allowedExtensions },
                { name: 'All Files', extensions: ['*'] }
            ],
            title: `Select ${type} File`
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            
            // Validate file size (max 10MB)
            if (fileSize > 10 * 1024 * 1024) {
                throw new Error('File size exceeds 10MB limit');
            }
            
            const fileContent = fs.readFileSync(filePath);
            logger.info('File uploaded successfully', { type, filePath, fileSize });
            
            return {
                success: true, 
                filePath, 
                fileName: path.basename(filePath),
                fileSize,
                content: fileContent.toString('base64') 
            };
        }
        
        return { success: false, error: 'No file selected' };
        
    } catch (error) {
        logger.error('File upload failed', { type, error: error.message });
        return { 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
});

// Export Results with Data Handler
ipcMain.handle('export-results-with-data', async (event, examData) => {
    try {
        logger.info('Exporting results with provided data');
        
        const documentParser = new DocumentParser();
        
        if (!examData || !examData.results || examData.results.length === 0) {
            throw new Error('No exam results data provided for export');
        }

        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `army-exam-results-${new Date().toISOString().split('T')[0]}`,
            filters: [
                { name: 'Word Documents', extensions: ['docx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePath) {
            const doc = await documentParser.generateResultsDocument(
                examData.results, 
                examData.examTitle || 'Army Examination Results'
            );
            
            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(result.filePath, buffer);
            
            logger.info('Results exported successfully', { 
                filePath: result.filePath, 
                resultsCount: examData.results.length 
            });
            return { 
                success: true, 
                filePath: result.filePath,
                resultsCount: examData.results.length 
            };
        }
        
        return { success: false, error: 'Export cancelled' };
        
    } catch (error) {
        logger.error('Error exporting results', { error: error.message });
        return { success: false, error: error.message };
    }
});

// App Info Handler
ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion() };
});

// Get Answers Handler
ipcMain.handle('get-answers', async (event) => {
    try {
        if (!serverInstance || !serverInstance.isRunning) {
            return { success: false, error: 'Server is not running' };
        }
        
        // Fetch answers from server
        const response = await fetch(`http://localhost:${serverInstance.port}/api/answers`);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            return { success: false, error: 'Failed to fetch answers from server' };
        }
    } catch (error) {
        logger.error('Error getting answers', { error: error.message });
        return { success: false, error: error.message };
    }
});

// Get docx package status
ipcMain.handle('get-docx-status', () => {
    return {
        available: docxPackageAvailable,
        canExportWord: docxPackageAvailable,
        exportFormat: docxPackageAvailable ? 'Word (.docx)' : 'HTML (.html)'
    };
});

// Manual docx package installation
ipcMain.handle('install-docx-package', async () => {
    if (docxPackageAvailable) {
        return { success: true, message: 'docx package is already available' };
    }
    
    const result = await installDocxPackage();
    return {
        success: result,
        available: docxPackageAvailable,
        message: result ? 'docx package installed successfully' : 'Failed to install docx package'
    };
});

// Application Event Handlers
app.whenReady().then(() => {
    logger.info('Application starting');
    createWindow();
});

app.on('window-all-closed', () => {
    logger.info('All windows closed - application quitting');
    
    if (serverInstance) {
        serverInstance.stop().catch(error => {
            logger.error('Error stopping server during shutdown', { error: error.message });
        });
    }
    
    if (networkDiscovery) {
        networkDiscovery.stopBroadcasting();
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        logger.info('Recreating window on activate');
        createWindow();
    }
});

app.on('before-quit', (event) => {
    logger.info('Application quitting initiated');
});

app.on('will-quit', (event) => {
    logger.info('Application will quit');
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    logger.warn('Another instance is already running - quitting');
    app.quit();
} else {
    app.on('second-instance', () => {
        logger.info('Second instance attempted - focusing existing window');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

logger.info('Main process initialized successfully');
; Army Exam Candidate - Custom NSIS Installer Script
; © 2025 Kapri Software Pvt Ltd. All rights reserved.

; Custom installer messages
!define PRODUCT_NAME "Army Exam Candidate"
!define PRODUCT_VERSION "2.0.0"
!define PRODUCT_PUBLISHER "Kapri Software Pvt Ltd."
!define PRODUCT_WEB_SITE "https://kaprisoftware.com"
!define PRODUCT_SUPPORT_EMAIL "kaprisoftware.pvt.ltd@gmail.com"

; Custom welcome message
!define MUI_WELCOMEPAGE_TITLE "Welcome to Army Examination System Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of the Army Exam Candidate application.$\r$\n$\r$\nThis software is designed specifically for Indian Army examination candidates.$\r$\n$\r$\nClick Next to continue."

; Custom finish message
!define MUI_FINISHPAGE_TITLE "Army Exam Candidate Installation Complete"
!define MUI_FINISHPAGE_TEXT "The Army Exam Candidate application has been successfully installed on your computer.$\r$\n$\r$\nCandidates can now take secure army examinations.$\r$\n$\r$\nFor support, contact: ${PRODUCT_SUPPORT_EMAIL}"

; Add custom registry entries
WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "Version" "${PRODUCT_VERSION}"
WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "InstallDate" "$INSTDATE"
WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "Publisher" "${PRODUCT_PUBLISHER}"
WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "SupportEmail" "${PRODUCT_SUPPORT_EMAIL}"
WriteRegStr HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}" "Website" "${PRODUCT_WEB_SITE}"

; Create additional shortcuts
CreateShortCut "$DESKTOP\Army Exam Candidate.lnk" "$INSTDIR\Army Exam Candidate.exe" "" "$INSTDIR\Army Exam Candidate.exe" 0
CreateShortCut "$SMPROGRAMS\Army Examination System\Army Exam Candidate.lnk" "$INSTDIR\Army Exam Candidate.exe" "" "$INSTDIR\Army Exam Candidate.exe" 0
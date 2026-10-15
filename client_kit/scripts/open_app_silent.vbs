' Happy Car Wash GMS - Silent Desktop App Launcher
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strTargetDir = "C:\HappyCarWash"
strPsScript = strScriptDir & "\open_app.ps1"

strCommand = "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & strPsScript & """ -TargetDir """ & strTargetDir & """"
objShell.Run strCommand, 0, False

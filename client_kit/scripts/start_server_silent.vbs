' Happy Car Wash GMS - Silent Server Starter
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strTargetDir = "C:\HappyCarWash"
strPsScript = strScriptDir & "\start_server.ps1"

strCommand = "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & strPsScript & """ -TargetDir """ & strTargetDir & """"
objShell.Run strCommand, 0, False

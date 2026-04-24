@echo off
setlocal

if not exist ".sandbox-home" mkdir ".sandbox-home"
if not exist ".sandbox-home\.expo" mkdir ".sandbox-home\.expo"

set "PATH=C:\laragon\bin\nodejs\node-v22;%PATH%"
set "EXPO_HOME=%~dp0.sandbox-home\.expo"
set "HOME=%~dp0.sandbox-home"
set "USERPROFILE=%~dp0.sandbox-home"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
C:\laragon\bin\nodejs\node-v22\npx.cmd expo run:android

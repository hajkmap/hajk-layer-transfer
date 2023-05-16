@REM Sometimes in an organisation, exe-files cant be executed for security reasons.
@REM But! Sometimes its possible to run nodejs stuff.
@REM So run this batch file to run dev-version using npm.
@REM Note that Startup is pretty slow

if not DEFINED IS_MINIMIZED set IS_MINIMIZED=1 && start "" /min "%~dpnx0" %* && exit
npm run start
exit
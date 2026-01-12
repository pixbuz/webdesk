# **Webdesk**
## **Description**
Webdesk is a passion project of mine with the aim of making an OS type experience in a web app.
## **Progress**
- Make an App Launcher Template
	- Make it Reflect the App's Information
	- Make it Open a Window when Clicked
- Make a Window Template
	- Make it Closable
	- Make it Resizable
	- Make it Maximisable
	- Make it Minimizable
	- Add Support for Custom Titlebars
	- Support Window to Window Comunication with Broadcast Channels (public comunication) or Message Ports (private comunication)
	- Support Window to Client Comunication with Broadcast Channels (public comunication) or Message Ports (private comunication)
	- Support Window to Backend Comunication with Web Sockets
- Make a Window Manager
	- Make Windows Movable
	- Manage Window Focus
	- Manage Window Overlapping
	- Add Keybind Window Switching
- Make a App Dock
	- Make it Show the Open Apps' Windows
	- Add a Clock & Date
- Add the Settings app
	- Add Customization for as many aspects of webdesk
	- Add a Background Upload
	- Add Customization Save/Upload

- Add the Blog app
	- Make it as modular as possible
- Add the Terminal app
	- idk
- Add a Chat app(?)
	- Prevent Spam
	- Bad Idea
- Add Security
	- Make a Custom Lock Screen
	- Make the FS read only up to the app folder
	- Generate a private ID for each app at server init to authorize certain actions (read/write and indexedb)
- Finalized Webdesk
	- Icons for the Apps
	- Animations for the Opening, Closing, Maximising, Minimizing a Window
	- Animations for the Opening, Closing, Maximising, Minimizing a Window App Dock Icon

### **User flow**
1. User loads up the page
	- ~~Load the Desktop~~
	- ~~Load the App Launchers~~
	- Restore any Customization
	- Restore any Open Windows from a Old Session
	- Restore any Widgets

2. User interacts with an App Launcher
	- ~~App Launcher calls the Window Manager~~
	- ~~Window Manager Spawns the App Window~~
	- ~~Window Manager Loads the Index Page of the App~~

3. User interacts with a Window
	- ~~Ensure it is Movable by the Handle~~
	- ~~Ensure it is Resizeable by the Borders~~
	- ~~Ensure the Clicks directly interact with the Content inside the Window~~
	- ~~Ensure the Window is Deleted when the User Closes it~~

4. The App Dock
	- ~~Make a Clock~~
	- ~~Make it Display the Open Apps~~
---
### **Notes**
- Add settings and customization options with CSS variables
	- Different Color Palettes
	- Desktop Image
	- Preferences
	- Themes
- Add a blog app
- Add a terminal app for fun
- Make Icons for the Apps
- Add the first time tutorial
- Add widgets
- Make a file system(?)
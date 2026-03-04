# **Webdesk**
Webdesk is a passion project of mine with the aim of making an OS type experience in a web app. Webdesk's objective is to provide maximum customization inside the browser, primarly for fun.
## **Desctiption**
Webdesk is a PWA that uses a Deno backend and HTML/JS for the frontend. The main gimmick of Webdesk are the **Applications**, which are static or dynamic web sites viewed inside the main page. These applications are opened from **Launchers** on the desktop. The applications are viewed from inside **Windows** that can be moved, resized and closed. The user can keep track of the open applications by checking the **App Dock** that contains the icons of the open applications, clicking on the icons will bring the corresponding application to the foreground and focus it. The windows use iframes for both the main content and the titlebar, allowing for custom functionalities tailored for the window application. The windows can also specify commands for the backend **API** for processing custom requests, allowing the windows to communicate with the backend using `fetch()` or directly using a `WebSocket`. Webdesk is built using event driven logic for maintainability and modularity in the frontend and static assets tables in the backend for speed, necessitating only a pathname lookup. A **Service Worker** is used to cache pages on the client side, relieving strain on the server and allowing offline use **(WIP)**. Webdesk supports custom color themes and backgrounds with light or dark icons.

(Event propagation tree diagram)

![Diagram showing the structure of a application window](images/window_diagram.svg)

As stated above the main part of Webdesk are windows. These `<article>` elements use two iframes to make use straightforward for both the user and application developer.


## **Progress**
- Make an App Launcher Template
	- [x] Make it Reflect the App's Information
	- [x] Make it Open a Window when Clicked
- Make a Window Template
	- [x] Make it Closable
	- [x] Make it Resizable
	- [x] Make it Maximisable
	- [x] Make it Minimizable
	- [x] Add Support for Custom Titlebars
	- [x] Support Window to Window Comunication with Broadcast Channels (public comunication) or Message Ports (private comunication)
	- [x] Support Window to Client Comunication with Broadcast Channels (public comunication) or Message Ports (private comunication)
	- [x] Support Window to Backend Comunication with Web Sockets
- Make a Window Manager
	- [x] Make Windows Movable
	- [x] Manage Window Focus
	- [x] Manage Window Overlapping
	- [ ] Add Keybind Window Switching
- Make a App Dock
	- [x] Make it Show the Open Apps' Windows
	- [x] Add a Clock & Date
- Add the Settings app
	- [ ] Add Customization for as many aspects of webdesk
	- [ ] Add a Background Upload
	- [ ] Add Customization Save/Upload
- Add the Blog app
	- [ ] Make it as modular as possible
- Add the Terminal app
	- [ ] idk
- Add the Info app
	- [ ] Basically a CV
- Make it into a PWA
	- [x] Add a service worker
	- [x] Add a manifest
	- [ ] Add a favicon
- Add Security
	- [ ] Make a Custom Lock Screen
	- [ ] Make the FS read only up to the app folder
	- [ ] Generate a private ID for each app at server init to authorize certain actions (read/write and indexedb)
	- [ ] Try catch every read and write operation
- Finalized Webdesk
	- [ ] Improve the service worker caching
	- [ ] Make an offline experience possible
	- [ ] Add Widgets
	- [ ] Icons for the Apps
	- [ ] Animations for the Opening, Closing, Maximising, Minimizing a Window
	- [ ] Animations for the Opening, Closing, Maximising, Minimizing a Window App Dock Icon
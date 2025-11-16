# **Webdesk**
I have been at it for 3 years

## **Project Structure**
```
webdesk
├── README.md
├── applications
│   └── manifests
├── backend
│   ├── functions
│   ├── functions.ts
│   └── main.ts
├── proxy.conf.json
├── public
├── src
│   ├── app
│   ├── components
│   ├── index.html
│   ├── spaces
│   └── styles.scss
└── utils
    └── utils.ts
```

* ```README.md```: This file
* ```applications```: Contains all the applications that can be runned in webdesk, both manifests and assets
	* ```applications/manifests```: Contains all the different application manifests. Any app is required to have one in order to get registered inside webdesk
* ```backend```: Contains all the files necessary for the backend API to work (written in Deno btw)
	* ```backend/functions```: Contains all the TypeScript files that can be ran from the API endpoint
	* ```backend/functions.ts```: A Typescript files that helps with a clean codebase. Exports all function files inside ```functions``` 
	* ```backend/main.ts```: The entrypoint for the Deno Backend API
* ```proxy.conf.json```: File used by Angular to forward requests to the backend  
* ```public```: Static files folder
* ```src```: Contains all the necessary Angular Files
	* ```src/app```: Contains the root application
	* ```src/components```: Contains the Angular components of webdesk
	* ```src/index.html```: HTML file with html, head and body wrapper
	* ```src/style.scss```: Contains the main styling sheet for the application
* ```utils```: Contains different classes, functions and interfaces that are used by both Front-end and Back-end (Angular and Deno)  
	* ```utils/utils.ts```: A Typescript files that helps with a clean codebas 

## **Roadmap**
Based on the workflow of the app this time:

1. **User loads the Page**
	- ~~Load the Desktop~~
	- ~~Load the App Spaces~~
	- Load the App Launchers
	- Restore any Customization
	- Restore any Widgets

2. **User Interacts with a Launcher**
	- App Launcher calls the WM
	- WM Spawns the Correct App
	- WM Loads the Index Page of said App

3. **User Interacts with a Window**
	- Ensure it is Movable by the Handle
	- Ensure Clicks directly interact with the Content inside the Window
	- Ensure the Window is Deleted when the User Closes it

4. **User Customizes the Settings**
	- Save the Customization Setting in LocalStorage
	- Update the Page in Real Time

## **Notes**
Window and app launchers are components

Spaces are components?
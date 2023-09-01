# Pictionary Clone

We are going to use `Socket.io` for node based communication between multiple systems, all the client connects to server and the server will process the request.

Add initial markup (`index.html, index.css, room.html, room.css`) in the client folder. 
Install `parcel-bundler`

```shell
npm init -y
npm i --save-dev parcel-bundler
```

Add scripts : 

```js
"scripts": {
    "start": "parcel index.html room.html",
    "build": "parcel build index.html room.html"
  },
```

 Create a new server folder and install `socket.io`

```shell
npm init -y
npm install socket.io
```

### Setting up `socket.io` (server side)

Initialize the server 

```js
// server.js
const { Server } = require("socket.io")

const io = new Server({})
io.on("connection", socket => {
    // runs once a client is connected to 3000
  console.log("Connected Successfully")
})

io.listen(3000)
```

### Setting up `socket.io` (client side)

```shell
npm install socket.io-client
```

```js
// room.js
import { io } from "socket.io-client"

const socket = io("http://localhost:3000")
console.log(socket)
// link the script in room.html
```

Run start script

```shell
npm start
```

Still the socket object has connected to false. Since the request is blocked by `CORS` policy.
Add the client URL to the server, as a option

```js
const { Server } = require("socket.io")

const io = new Server({
  cors: {
    origin: "http://localhost:1234",
  },
})
io.on("connection", socket => {
  console.log("Connected Successfully")
})

io.listen(3000)
```

Now the client is successfully connected to the server.

**Some client side fixes for the user**

Make sure that a user name and room id is provided if the user in is the `room.html` page. Else redirect the user to the `index.html`

```js
// room.js
const urlParams = new URLSearchParams(window.location.search) // gets everything after the ? in the URL
const name = urlParams.get("name")
const roomId = urlParams.get("room-id")
console.log(name, roomId)
```

Get all the elements that are required in js file

```js
// room.js
const guessForm = document.querySelector("[data-guess-form]")
const guessInput = document.querySelector("[data-guess-input]")
const wordElement = document.querySelector("[data-word]")
const messagesElement = document.querySelector("[data-messages]")
const readyButton = document.querySelector("[data-ready-btn]")
const canvas = document.querySelector("[data-canvas]")
```

Hide `guessForm` and `wordElement` initially

```js
resetRound()

function resetRound() {
  hide(guessForm)
}

function hide(element) {
  element.classList.add("hide")
}
```

Now let's communicate information from the client to the server
Let's send the user name and room id to the server

```js
// room.js = client
socket.emit("joined-room", {
  name: name,
  roomId: roomId,
})
// accessing data on from server = server.js
io.on("connection", socket => {
  socket.on("joined-room", data => {
    console.log(data)
  })
})
```

### Storing rooms information, locally in the server

```js
// server.js
const rooms = {}

io.on("connection", socket => {
  socket.on("joined-room", data => {
      // each new socket has an id, and we can use it as the users id
      // create user
    const user = { id: socket.id, name: data.name, socket: socket }

    // get room
    let room = rooms[data.roomId]
    // if room doesn't exists, create one
    if (room == null) {
      room = { users: [], id: data.roomId }
      rooms[data.roomId] = room
    }
	// add the user
    room.users.push(user)
     // join the room
    socket.join(room.id)
    console.log(room)
  })
})
```

All works wells, we do get the room and the user info stored, but once a user refreshes, and new connection is created and the same user is joined with a different id, without removing the previous one. 

```js
// server.js
   socket.join(room.id)
	// remove the disconnected user
    socket.on("disconnect", () => {
      room.users = room.users.filter(u => u !== user)
    })
```

### Adding Event Listeners

```js
// room.js
readyButton.addEventListener("click", () => {
  hide(readyButton)
  socket.emit("ready") // socket contains the user info so, no need to send that
})
```

```js
// server.js
socket.on("ready", () => {
      user.ready = true
      if (room.users.every(u => u.ready)) {
        // start the game
      }
    })
```

Pick a random drawer and a random word

```js
 if (room.users.every(u => u.ready)) {
        room.word = getRandomEntry(WORDS)
        room.drawer = getRandomEntry(room.users)
 }

// ...
function getRandomEntry(array) {
  array[Math.floor(Math.random() * array.length)]
}
```

Now we need to send a message to the drawer to draw along with the word and also we need to send a message to everyone else to guess the word.
Each Socket is in a room, which has a id of `socket.id` and access the room as `socket.rooms` (different from the rooms object that we have declared).

So the drawer is in a room alone with the id of `room.drawer.id`, and now we can send the message to him alone.

```js
// server.js
if (room.users.every(u => u.ready)) {
        room.word = getRandomEntry(WORDS)
        room.drawer = getRandomEntry(room.users)
    	// send a msg just to drawer to start drawing, with the word
        io.to(room.drawer.id).emit("start-drawing", room.word)
    	// send msg to every one except the drawer to guess
        room.drawer.socket.to(room.id).emit("start-guessing")
}
```

`io.to` is used to send message to every one, but in the second case we are using `drawer.socket` to emit the message, which sends the message to every one except for itself.

### Draw on Canvas

Create a new `DrawableCanvas.js` file in the client folder

```js
// need canvas to draw on and socket to emit the message that drawLines
function DrawableCanvas(canvas, socket) {
  let prevPosition = null

  canvas.addEventListener("mousemove", e => {
    if (e.buttons !== 1) {
      prevPosition = null
      return
    }
	// layerX and layerY gives the X and Y values relative the element we are on (in this case the canvas), instead of using e.pageX or e.clientX
    const newPosition = { x: e.layerX, y: e.layerY }
    if (prevPosition != null) {
      drawLine(prevPosition, newPosition) // need to implement
    }

    prevPosition = newPosition
  })
}
```

Implement Draw line function

```js
function drawLine(start, end) {
    const context = canvas.getContext("2d")
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.stroke()
  }
```

Use the `DrawableCanvas` function in `room.js`

```js
import DrawableCanvas from "./DrawableCanvas"
// ....
const drawableCanvas = new DrawableCanvas(canvas, socket)
```

 We can draw now, but the calibration is off. It is because canvas have problem scaling, we are required to set a fixed width and height for it to function properly. Which is not possible since the user can resize the browser. So let's add a event listener that set the new dimension on each resize

```js
// room.js

window.addEventListener("resize", resizeCanvas)
function resizeCanvas() {
  canvas.width = null
  canvas.height = null
  const clientDimensions = canvas.getBoundingClientRect()
  canvas.width = clientDimensions.width
  canvas.height = clientDimensions.height
}

// also call the resizeCanvas for intial setting up
resizeCanvas()
```

Emit the drawn positions to the server

```js
// DrawableCanvas.js
if (prevPosition != null) {
      drawLine(prevPosition, newPosition)
      socket.emit("draw", {
        start: prevPosition,
        end: newPosition,
      })
 }
```

Server emit that to the rest of the users of the room

```js
//server.js
socket.on("draw", data => {
      socket.to(room.id).emit("draw-line", data.start, data.end)
 })
```

Now we can draw the required path

```js
// DrawableCanvas.js
socket.on("draw-line", drawLine)
```

### Normalize the points

There is one problem here, the image is of the same size on each screen, so on smaller screen the drawing might go off screen. To handle this we need to normalize the points from 0 to 1 for each screen

```js
function normalizeCoordinates(position) {
    return {
      x: position.x / canvas.width,
      y: position.y / canvas.height,
    }
  }

  function toCanvasSpace(position) {
    return {
      x: position.x * canvas.width,
      y: position.y * canvas.height,
    }
  }

// Now use it
// Normalize before sending
drawLine(prevPosition, newPosition)
      socket.emit("draw", {
        start: normalizeCoordinates(prevPosition),
        end: normalizeCoordinates(newPosition),
})
// scale before drawing
socket.on("draw-line", (start, end) => {
    drawLine(toCanvasSpace(start), toCanvasSpace(end))
  })
```

### Only the drawer can draw

```js
export default function DrawableCanvas(canvas, socket) {
  // added to this, so that it is accessable outside the function (since this is returned)
  this.canDraw = false
    
  // ...
  if(e.buttons !== 1 || !this.canDraw) {
      prevPosition = null
      return
    }
    
// room.js
 function startRoundDrawing(word) {
  drawableCanvas.canDraw = true
  wordElement.innerText = word
}
    
// ... 
function resetRound() {
  drawableCanvas.canDraw = false
  hide(guessForm)
}
```

### Make guess form functional

Display guessed messages

```js
// room.js
guessForm.addEventListener("submit", e => {
  e.preventDefault()
  if (guessInput.value === "") return

  displayGuess(name, guessInput.value)
  guessInput.value = ""
})

// ... 
function displayGuess(guesserName, guess) {
  const guessElement = guessTemplate.content.cloneNode(true)
  const nameElement = guessElement.querySelector("[data-name]")
  const messageElement = guessElement.querySelector("[data-text]")
  nameElement.innerText = guesserName
  messageElement.innerText = guess
  messagesElement.append(guessElement)
}

// also at the top
const guessTemplate = document.querySelector("[data-guess-template]")
```

Display the guess messages to all the users

```js
guessForm.addEventListener("submit", e => {
  e.preventDefault()
  if (guessInput.value === "") return
	// send the guess to the server
  socket.emit("make-guess", { guess: guessInput.value })
  displayGuess(name, guessInput.value)
  guessInput.value = ""
})

```

```js
// server.js , sends to all the rooms
socket.on("make-guess", data => {
      socket.to(room.id).emit("guess", user.name, data.guess)
})
```

```js
// display the guess
socket.on("guess", displayGuess)
```

### Decide the winner

```js
// server.js
socket.on("make-guess", data => {
      socket.to(room.id).emit("guess", user.name, data.guess)
      if (data.guess.toLowerCase().trim() === room.word.toLowerCase()) {
          // Notice that: have use io.to to send to each user, not socket.to that sends to each user except for itself
        io.to(room.id).emit("winner", user.name, room.word)
        room.users.forEach(u => {
          u.ready = false
       })
    }
})
```

```js
socket.on("winner", resetRound)

// ...
function resetRound(name, word) {
  // since word and name are optional params
  if (word && name) {
    wordElement.innerText = word
    show(wordElement)
    // show the winner
    displayGuess(null, `${name} is the winner`)
  }

  drawableCanvas.canDraw = false
  hide(guessForm)
}
```

### Next round setup

```js
function resetRound(name, word) {
  // since word and name are optional params
  if (word && name) {
    wordElement.innerText = word
    show(wordElement)
    // show the winner
    displayGuess(null, `${name} is the winner`)
  }

  drawableCanvas.canDraw = false
  // show the ready button == new code
    show(readyButton)
  hide(guessForm)
}
```

Clear the canvas

```js
function startRoundDrawing(word) {
  drawableCanvas.canDraw = true
  drawableCanvas.clearCanvas()

  wordElement.innerText = word
}

function startRoundGuessing() {
  show(guessForm)
  drawableCanvas.clearCanvas()
}

// DrawableCanvas.js
export default function DrawableCanvas(canvas, socket) {
  this.canDraw = false
  this.clearCanvas = function () {
    const context = canvas.getContext("2d")
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
    
    // ...
    
}
```

Clear old messages before next round

```js
function startRoundDrawing(word) {
  drawableCanvas.canDraw = true
  drawableCanvas.clearCanvas()

  messagesElement.innerHTML = ""
  wordElement.innerText = word
}

function startRoundGuessing() {
  show(guessForm)
  hide(wordElement)
  drawableCanvas.clearCanvas()
  messagesElement.innerHTML = ""
  // also clear the word for the guesser
  wordElement.innerText = ""
}
```


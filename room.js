import { io } from "socket.io-client"
import { startConfetti, stopConfetti } from "./confetti"
import DrawableCanvas from "./DrawableCanvas"

const production = process.env.NODE_ENV === "production"
const serverUrl = production
  ? "https://scribble-backend.herokuapp.com/"
  : "http://localhost:3000"

const urlParams = new URLSearchParams(window.location.search)
const name = urlParams.get("name")
const roomId = urlParams.get("room-id")

if (!name || !roomId) window.location = "/index.html"

// const socket = io(serverUrl)
const socket = io("https://scribble-backend.herokuapp.com/", {
  transports: ["websocket"],
})

const guessForm = document.querySelector("[data-guess-form]")
const guessInput = document.querySelector("[data-guess-input]")
const wordElement = document.querySelector("[data-word]")
const messagesElement = document.querySelector("[data-messages]")
const readyButton = document.querySelector("[data-ready-btn]")
const canvas = document.querySelector("[data-canvas]")
const drawableCanvas = new DrawableCanvas(canvas, socket)
const guessTemplate = document.querySelector("[data-guess-template]")

const activeToolTextElement = document.querySelector("#active-tool")
const brush = document.querySelector("#brush")
const brushColor = document.querySelector("#brush-color")
const brushSizeText = document.querySelector("#brush-size")
const brushSizeInput = document.querySelector("#brush-slider")
const bucketColorInput = document.querySelector("#bucket-color")
const eraser = document.querySelector("#eraser")
const clearCanvas = document.querySelector("#clear-canvas")
const toolBar = document.querySelector(".top-bar")

let strokeColor = "#000000"
let canvasColor = "#FFFFFF"
let isEraser = false
let strokeWidth = 1

function updateContextForGuessers(contextValueObj) {
  socket.emit("update-context", { newContext: contextValueObj })
}

function theBrushFunction() {
  isEraser = false
  brush.style.color = "black"
  eraser.style.color = "white"
  strokeColor = brushColor.style.backgroundColor
  drawableCanvas.setContext({
    strokeStyle: strokeColor,
    lineWidth: strokeWidth,
  })
  updateContextForGuessers({ strokeStyle: strokeColor, lineWidth: strokeWidth })
  activeToolTextElement.textContent = "Brush"
}

brush.addEventListener("click", theBrushFunction)

brushColor.addEventListener("change", theBrushFunction)

bucketColorInput.addEventListener("change", () => {
  canvasColor = bucketColorInput.style.backgroundColor
  drawableCanvas.setContext({ fillStyle: canvasColor })
  updateContextForGuessers({ fillStyle: canvasColor })
  if (isEraser) {
    drawableCanvas.setContext({ strokeStyle: canvasColor })
  }
})

clearCanvas.addEventListener("click", () => {
  drawableCanvas.clearCanvas()
  updateContextForGuessers({ clearCanvas: 1 })
})

eraser.addEventListener("click", () => {
  isEraser = true
  brush.style.color = "white"
  eraser.style.color = "black"
  activeToolTextElement.textContent = "Eraser"
  drawableCanvas.setContext({
    strokeStyle: canvasColor,
    lineWidth: strokeWidth * 10,
  })
  updateContextForGuessers({
    strokeStyle: canvasColor,
    lineWidth: strokeWidth * 10,
  })
})

function theBrushSizeFunction() {
  strokeWidth = brushSizeInput.value
  brushSizeText.textContent = strokeWidth
  if (isEraser) {
    drawableCanvas.setContext({ lineWidth: strokeWidth * 10 })
    updateContextForGuessers({ lineWidth: strokeWidth * 10 })
  } else {
    drawableCanvas.setContext({ lineWidth: strokeWidth })
    updateContextForGuessers({ lineWidth: strokeWidth })
  }
}

brushSizeInput.addEventListener("change", theBrushSizeFunction)

socket.emit("joined-room", {
  name: name,
  roomId: roomId,
})
socket.on("start-drawing", startRoundDrawing)
socket.on("start-guessing", startRoundGuessing)
socket.on("guess", displayGuess)
socket.on("winner", resetRound)
socket.on("new-context", newContext => {
  drawableCanvas.setContext(newContext)
})

readyButton.addEventListener("click", () => {
  stopConfetti()
  hide(readyButton)
  socket.emit("ready") // socket contains the user info so, no need to send that
})

guessForm.addEventListener("submit", e => {
  e.preventDefault()
  if (guessInput.value === "") return

  socket.emit("make-guess", { guess: guessInput.value })
  displayGuess(name, guessInput.value)
  guessInput.value = ""
})

window.addEventListener("resize", resizeCanvas)

function displayGuess(guesserName, guess) {
  const guessElement = guessTemplate.content.cloneNode(true)
  const nameElement = guessElement.querySelector("[data-name]")
  const messageElement = guessElement.querySelector("[data-text]")
  nameElement.innerText = guesserName
  messageElement.innerText = guess
  messagesElement.append(guessElement)
}

function startRoundDrawing(word) {
  show(toolBar)
  drawableCanvas.canDraw = true
  drawableCanvas.clearCanvas()

  messagesElement.innerHTML = ""
  wordElement.innerText = word
}

function startRoundGuessing() {
  hide(toolBar)
  show(guessForm)
  hide(wordElement)
  drawableCanvas.clearCanvas()
  messagesElement.innerHTML = ""
  wordElement.innerText = ""
}

function resizeCanvas() {
  canvas.width = null
  canvas.height = null
  const clientDimensions = canvas.getBoundingClientRect()
  canvas.width = clientDimensions.width
  canvas.height = clientDimensions.height
}

resetRound()
resizeCanvas()

function resetRound(name, word) {
  // since word and name are optional params
  if (word && name) {
    wordElement.innerText = word
    show(wordElement)
    // show the winner
    displayGuess(null, `${name} is the winner`)
    startConfetti()
  }

  drawableCanvas.canDraw = false
  theBrushFunction()
  brushSizeInput.value = 1
  theBrushSizeFunction()
  show(readyButton)
  hide(guessForm)
}

function hide(element) {
  element.classList.add("hide")
}

function show(element) {
  element.classList.remove("hide")
}

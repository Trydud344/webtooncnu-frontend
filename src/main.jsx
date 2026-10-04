import React from 'react'
import ReactDOM from 'react-dom/client'
import gsap from 'gsap'
import App from './App.jsx'
import './index.css'

window.gsap = gsap

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

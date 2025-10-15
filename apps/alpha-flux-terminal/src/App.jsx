import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import './App.css'

function App() {
  const [opportunities, setOpportunities] = useState([])
  const [connected, setConnected] = useState(false)
  const [ws, setWs] = useState(null)

  useEffect(() => {
    // Connect to WebSocket server
    const websocket = new WebSocket('ws://localhost:3000/ws')

    websocket.onopen = () => {
      console.log('Connected to WebSocket')
      setConnected(true)
      websocket.send('Hello from client')
    }

    websocket.onmessage = (event) => {
      console.log('Message from server:', event.data)
      // In a real scenario, this would parse opportunity data and update state
      // For now, we'll just log the message
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnected(false)
    }

    websocket.onclose = () => {
      console.log('Disconnected from WebSocket')
      setConnected(false)
    }

    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, [])

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Alpha Flux Terminal</h1>
      
      <div className="mb-4">
        <span className={`inline-block px-3 py-1 rounded-full text-sm ${connected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Arbitrage Opportunities</CardTitle>
          <CardDescription>Real-time arbitrage opportunities detected by the engine</CardDescription>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <p className="text-gray-500">No opportunities detected yet. Waiting for data...</p>
          ) : (
            <ul>
              {opportunities.map((opp, index) => (
                <li key={index} className="mb-2">
                  <div className="border p-4 rounded">
                    <p><strong>Route:</strong> {opp.route}</p>
                    <p><strong>Profit:</strong> {opp.profit}%</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current status of the arbitrage system</CardDescription>
        </CardHeader>
        <CardContent>
          <p><strong>Engine Status:</strong> Running</p>
          <p><strong>Last Update:</strong> {new Date().toLocaleTimeString()}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default App


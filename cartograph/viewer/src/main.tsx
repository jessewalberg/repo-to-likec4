import { ReactFlowProvider } from '@xyflow/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { loadData } from './lib/loadData'

const root = createRoot(document.getElementById('root') as HTMLElement)

loadData().then((data) => {
  root.render(
    <StrictMode>
      <ReactFlowProvider>
        <App data={data} />
      </ReactFlowProvider>
    </StrictMode>,
  )
})

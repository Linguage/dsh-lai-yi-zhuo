import React from 'react'
import { createRoot } from 'react-dom/client'
import { TablesApp as App } from './TablesApp.tsx'
import './styles.css'
import './tables.css'
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)

import './variants.css'

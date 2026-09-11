import { BrowserRouter } from "react-router-dom";
import { AppRoute } from "./Router/AppRouter.jsx";
import { FultangProvider } from "./Utils/Provider.jsx";
import { FeedbackProvider } from "./contexts/FeedbackContext.jsx";
import { FultangGlobalErrorOverlay } from "./GlobalComponents/FultangGlobalErrorOverlay.jsx";




export default function App() {
    return (
        <FultangProvider>
            <FeedbackProvider>
                <BrowserRouter>
                    <div className='min-h-screen overflow-y-auto overflow-x-hidden'>
                        <AppRoute />
                    </div>
                    <FultangGlobalErrorOverlay />
                </BrowserRouter>
            </FeedbackProvider>
        </FultangProvider>
    )
}
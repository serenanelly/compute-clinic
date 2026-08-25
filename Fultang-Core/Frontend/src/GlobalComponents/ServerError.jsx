import {ServerCrash, RefreshCcw, MailIcon, PhoneCall} from 'lucide-react';
import PropTypes from "prop-types";

export default function ServerErrorPage({errorStatus, message}) {

    ServerErrorPage.propTypes = {
        errorStatus: PropTypes.number.isRequired,
        message: PropTypes.string,
    }


    const handleRefresh = () => {
        window.location.reload();
    };

    if (errorStatus)
    return (
        <div className="h-screen overflow-y-hidden flex justify-center p-4">
            <div className="max-w-4xl w-full text-center">
                <div className="mb-8 relative">
                    <div className="w-24 h-24 bg-red-100 rounded-full mx-auto flex items-center justify-center">
                        <ServerCrash className="w-12 h-12 text-red-600"/>
                    </div>
                    <div
                        className="w-32 h-32 bg-red-50 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 animate-pulse"/>
                </div>

                <h1 className="text-3xl font-bold  mb-4">
                    Server Error
                </h1>
                <div className="flex flex-col text-gray-600 w-2xl text-md mx-auto gap-3">
                    {message && <p>{message}</p>}
                    {errorStatus === 503  || errorStatus===500 && <p>An internal error has occurred on our servers, try refreshing the page, or going back and attempting the action again.</p>}
                </div>

                <div className="mt-4 text-md max-w-4xl text-gray-500 inline-flex gap-2 mb-8">
                    <p>If the problem persists, contact our technical support: </p>
                    <div className="text-primary-start font-semibold flex gap-1">
                        <MailIcon/>
                        <p className="mr-4">technicalsupport@fultang.com</p>
                        <PhoneCall/>
                        <p>+237 6 98 55 25 32</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="text-xl text-gray-500">
                        Error code: <span className="font-mono">{errorStatus}</span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="inline-flex items-center font-bold px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-700 transition-all duration-300 group"
                    >
                        <RefreshCcw className="w-6 h-6 mr-2 group-hover:rotate-180 transition-transform duration-500"/>
                        Retry !!
                    </button>
                </div>

            </div>
        </div>
    );
}

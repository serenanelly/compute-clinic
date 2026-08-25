import PropTypes from 'prop-types';
import {useNavigate} from "react-router-dom";
import accessDeniedImage from "../assets/accessDenied.png";
import {AppRoutesPaths} from "../Router/appRouterPaths.js";




export function AccessDenied({Role})
{
    AccessDenied.propTypes = {
        Role: PropTypes.string.isRequired,
    };


    const navigate = useNavigate();


   return (
        <div
            style={{
                backgroundImage: `url(${accessDeniedImage})`,
                height: "100vh",
                width: "100%",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
            }}
            className="flex flex-col ml-5 ">
            <div>
                <p className="mt-32  text-8xl mb-10 font-bold text-primary-start">Fultang</p>
                <p className="text-5xl mb-6 font-bold text-red-500"> 403 ERROR : Access Denied</p>
                <h1 className="text-2xl text-black font-bold ">
                    Access denied for {Role} view, please log in as a {Role}
                </h1>
                <div className="flex">
                    <button
                        onClick={() => navigate(AppRoutesPaths.loginPage)}
                        className="mt-6 hover:bg-blue-800 duration-300 transition-all justify-start w-20 h-12 bg-primary-start text-white font-bold rounded-lg mr-3">
                        Log In
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        className="mt-6 hover:bg-blue-800 duration-300 transition-all justify-start w-20 h-12 bg-primary-start text-white font-bold rounded-lg">
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    )
}

import { useNavigate} from 'react-router-dom';
import robotImage from "../assets/robotNotFound.png";



export function NotFound () {

    const navigate = useNavigate()
    return (
        <div className="h-screen overflow-hidden bg-gradient-to-r from-primary-start to-primary-end flex justify-between ">
            <div className=" mt-36  flex flex-col ml-10" >
                <span className="text-9xl font-bold mb-16 text-white">Fultang</span>
                <span className="text-5xl font-bold text-white mb-4">404 Not Found</span>
                <div className="text-2xl text-white font-bold ">
                    The page you are trying to access does not exist.
                </div>
                <button
                    onClick={()=>navigate(-1)}
                    className="mt-6  hover:bg-blue-800 duration-300 transition-all justify-start w-20 h-12 bg-secondary text-white font-bold rounded-lg ">
                    Go Back
                </button>

            </div>
            <div className="mt-32">
                <img src={robotImage} alt="404 Error" className="w-[400px] h-[500px] mr-16"/>
            </div>
        </div>
    );
}



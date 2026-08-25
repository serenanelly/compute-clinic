import {FaArrowLeft, FaArrowRight, FaSearch} from "react-icons/fa";
import {Tooltip} from "antd";
import {useEffect, useState} from "react";
import axiosInstance from "../Utils/axiosInstance.js";
import Loader from "./Loader.jsx";
import ServerErrorPage from "./ServerError.jsx";
import {calculateNumberOfSlides} from "../Utils/paginationFunctions.js";


export function MedicalStaffList()
{



    const [medicalStaffList, setMedicalStaffList] = useState([]);
    const [numberOfMedicalStaff, setNumberOfMedicalStaff] = useState(0);
    const [nexUrlForRenderMedicalStaffList, setNexUrlForRenderMedicalStaffList] = useState(null);
    const [previousUrlForRenderMedicalStaffList, setPreviousUrlForRenderMedicalStaffList] = useState(null);
    const [actualPageNumber, setActualPageNumber] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [errorStatus, setErrorStatus] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");






    async function fetchMedicalStaffData(url = "/medical-staff/") {
        setIsLoading(true);
        try {
            const response = await axiosInstance.get(url);
            setIsLoading(false);

            if (response.status === 200) {
                setMedicalStaffList(response.data.results);
                setNumberOfMedicalStaff(response.data.count);
                setNexUrlForRenderMedicalStaffList(response.data.next);
                setPreviousUrlForRenderMedicalStaffList(response.data.previous);
                console.log(response.data);
                setErrorStatus(null);
                setErrorMessage("");
            }
        } catch (error) {
            setIsLoading(false);
            setMedicalStaffList([]);
            setNumberOfMedicalStaff(0);
            setNexUrlForRenderMedicalStaffList("");
            setPreviousUrlForRenderMedicalStaffList("");
            setErrorMessage("Something went wrong went retrieving medical staff list");
            setErrorStatus(error.status);
            console.log(error);
        }
    }


    async function fetchMedicalStaffList() {
        await fetchMedicalStaffData();
    }


    async function fetchNextOrPreviousPatientList(url) {
        if (url) {
            await fetchMedicalStaffData(url);
        }
    }


    useEffect(() => {
        fetchMedicalStaffList();
    }, []);


    function updateActualPageNumber(action) {
        if (action === "next")
        {
            if(actualPageNumber < calculateNumberOfSlides(numberOfMedicalStaff,5))
            {
                setActualPageNumber(actualPageNumber + 1);
            }
        }
        else
        {
            if(actualPageNumber > 1)
            {
                setActualPageNumber(actualPageNumber - 1);
            }
        }
    }







    return (
        <>
            <div className="flex justify-between mb-5">
                <div className="flex flex-col mt-3 ml-5">
                    {/*  <p className="font-bold text-2xl">Reception</p>  */}
                    <p className="font-bold text-xl">List of Medical Staffs</p>
                </div>
                <div className="flex mr-5 mt-2">
                    <div className="flex w-[400px] h-10 border-2 border-secondary rounded-lg">
                        <FaSearch className="text-xl text-secondary m-2"/>
                        <input
                            placeholder={"search for a specific medical staff member"}
                            type="text"
                            className="w-full mr-2 border-none focus:outline-none focus:ring-0"
                        />
                    </div>
                    <button className="ml-2 w-20 h-10 text-white bg-secondary rounded-lg">
                        Search
                    </button>
                </div>
            </div>


            {isLoading ? (<div className="h-[500px] w-full flex justify-center items-center">
                <Loader size={"medium"} color={"primary-end"}/>
            </div>): errorStatus ? (
                    <div className="mt-16">
                        <ServerErrorPage errorStatus={errorStatus} message={errorMessage}/>
                    </div>
                ) : medicalStaffList.length > 0 ?
                (
                    <>
                        <div className="ml-5 mr-5 mt-2 border-2 h-[500px] rounded-lg shadow-lg  p-2">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                <tr>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200">No</th>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200">First
                                        Name
                                    </th>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200 ">Last
                                        Name
                                    </th>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200 ">Gender</th>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200 ">Email</th>
                                    <th className="text-center p-3 text-xl font-bold border-r-2 border-gray-200 ">Role</th>
                                    <th className="text-center p-3 text-xl font-bold ">CNI number</th>
                                </tr>
                                </thead>
                                <tbody className="mt-5">
                                {medicalStaffList.map((person, index) => (
                                    <tr key={index} className="bg-gray-100">
                                        <td className="p-6 text-md text-blue-900 rounded-l-lg text-center">{index + 1}</td>
                                        <td className="p-6 text-md text-blue-900  text-center">{person.first_name}</td>
                                        <td className="p-6 text-md text-center ">{person.last_name}</td>
                                        <td className="p-6 text-md text-center ">{person.gender}</td>
                                        <td className="p-6 text-md text-center ">{person.email}</td>
                                        <td className="p-6 text-md text-center ">{person.role}</td>
                                        <td className="p-6 flex justify-center rounded-r-xl">{person.cniNumber}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>


                        <div className="fixed w-full justify-center -right-16 bottom-0 flex mt-6 mb-4">
                            <div className="flex gap-4">
                                <Tooltip placement={"left"} title={"previous slide"}>
                                    <button
                                        onClick={async () => {await fetchNextOrPreviousPatientList(previousUrlForRenderMedicalStaffList), updateActualPageNumber("prev")}}
                                        className="w-14 h-14 border-2 rounded-lg hover:bg-secondary text-xl  text-secondary hover:text-2xl duration-300 transition-all  hover:text-white shadow-xl flex justify-center items-center mt-2">
                                        <FaArrowLeft/>
                                    </button>
                                </Tooltip>
                                <p className="text-secondary text-2xl font-bold mt-4">{actualPageNumber}/{calculateNumberOfSlides(numberOfMedicalStaff,5)}</p>
                                <Tooltip placement={"right"} title={"next slide"}>
                                    <button
                                        onClick={async () => {await fetchNextOrPreviousPatientList(nexUrlForRenderMedicalStaffList), updateActualPageNumber("next")}}
                                        className="w-14 h-14 border-2 rounded-lg hover:bg-secondary text-xl  text-secondary hover:text-2xl duration-300 transition-all  hover:text-white shadow-xl flex justify-center items-center mt-2">
                                        <FaArrowRight/>
                                    </button>
                                </Tooltip>
                            </div>
                        </div>
                    </>
                ) :(
                    <div className="flex flex-col items-center justify-center h-[500px]  p-8">
                        <div className="mb-6 relative">
                            <svg
                                className="w-24 h-24 text-teal-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            {/* Animation de pulsation */}
                            <span className="absolute top-0 left-0 w-full h-full bg-teal-200 rounded-full animate-ping opacity-75"></span>
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-teal-700 mb-4">No medical personnel have been registered at this time.</h2>
                    </div>
                )
            }
        </>
    )
}
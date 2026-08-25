import {useEffect, useState} from "react";
import PropTypes from "prop-types";
import axiosInstance from "../../Utils/axiosInstance.js";

export function EditMedicalStaffInfosModal({ isOpen, onClose, setCanOpenSuccessModal, setSuccessMessage, setIsLoading, medicalStaffData }) {

    EditMedicalStaffInfosModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        setCanOpenSuccessModal: PropTypes.func.isRequired,
        setSuccessMessage: PropTypes.func.isRequired,
        setIsLoading: PropTypes.func.isRequired,
        medicalStaffData: PropTypes.object.isRequired
    };


    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        date_joined: '',
        gender: '',
        email: '',
        cniNumber: '',
        username:'',
        isActive:'',
        role: '',
        password: '',
    });
    const [error, setError] = useState("");
    const [checkedFields, setCheckedFields] = useState({
        first_name: false,
        last_name: false,
        date_joined: false,
        gender: false,
        username: false,
        cniNumber: false,
        isActive: false,
        email: false,
        role: false,
        password: false,
    });



    useEffect(() => {
        if (medicalStaffData) {
            setFormData(medicalStaffData);
        }
    }, [medicalStaffData]);



    function handleChange(e) {
        const { name, value } = e.target;
        if (name === 'date_joined') {
            const date = new Date(value).toISOString();
            setFormData(prevData => ({ ...prevData, [name]: date }));
        } else {
            setFormData(prevData => ({ ...prevData, [name]: value }));
        }
    }


    function handleCheckboxChange(e) {
        const { name, checked } = e.target;
        setCheckedFields(prev => ({ ...prev, [name]: checked }));
    }


    async function handleSubmit(e) {
        e.preventDefault();
        setIsLoading(true);
            const updatedData = Object.keys(checkedFields).reduce((acc, key) => {
                if (checkedFields[key]) {
                    acc[key] = formData[key];
                }
                return acc;
            }, {});

            try {
                const response = await axiosInstance.patch(`/medical-staff/${medicalStaffData.id}/`, updatedData);
                if (response.status === 200) {
                    setIsLoading(false);
                    setSuccessMessage(`${medicalStaffData.role + " " + medicalStaffData.username} 's information has been updated successfully!`);
                    setCanOpenSuccessModal(true);
                    onClose();
                }
            } catch (error) {
                setIsLoading(false);
                setSuccessMessage("");
                setCanOpenSuccessModal(false);
                setError("Something went wrong, please try again later!");
                console.log(error);
            }
        setIsLoading(false);
    }

    function applyFormStyle() {
        return "w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-primary-end";
    }


    function applyCheckboxStyle() {
        return "form-checkbox h-3 w-3 mt-4 text-primary-end";
    }


    function formatDateForInput(isoDate){
        try {
            const date = new Date(isoDate);
            return date.toISOString().slice(0, 16);
        } catch (error) {
            console.error( error);
            return '';
        }
    }


    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
                    <div className="bg-gradient-to-r from-primary-end to-primary-start px-6 py-4 rounded-t-lg flex-col flex justify-center items-center">
                        <h3 className="text-4xl font-bold text-white">Edit Medical Staff Information</h3>
                        <div className="flex mt-3">
                            <p className="text-white font-semibold ml-3 italic">(Please check the fields you want to modify)</p>
                        </div>
                    </div>
                    {error && <p className="text-red-500 font-bold text-md ml-4">{error}</p>}
                    <form onSubmit={handleSubmit} className="p-4 space-y-6">
                        <div className="flex space-x-3">
                            <div className="w-full flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkFirstName"
                                    name="first_name"
                                    checked={checkedFields.first_name}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="firstName"
                                           className="block text-sm font-medium text-gray-700 mb-1">Firstname</label>
                                    <input
                                        type="text"
                                        id="first_name"
                                        name="first_name"
                                        placeholder="Enter medical staff's first name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.first_name}
                                        disabled={!checkedFields.first_name}
                                    />
                                </div>
                            </div>


                            <div className="w-full flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkLastName"
                                    name="last_name"
                                    checked={checkedFields.last_name}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="lastName"
                                           className="block text-sm font-medium text-gray-700 mb-1">Lastname</label>
                                    <input
                                        type="text"
                                        id="last_name"
                                        name="last_name"
                                        placeholder="Enter medical staff's last name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.last_name}
                                        disabled={!checkedFields.last_name}
                                    />
                                </div>
                            </div>
                        </div>


                        <div className="flex space-x-2">
                            <div className="w-1/3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkLastName"
                                    name="username"
                                    checked={checkedFields.username}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="lastName"
                                           className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        placeholder="Enter medical staff's username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.username}
                                        disabled={!checkedFields.username}
                                    />
                                </div>
                            </div>

                            <div className="w-1/3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkLastName"
                                    name="password"
                                    checked={checkedFields.password}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="lastName"
                                           className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        placeholder="Enter medical staff's password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.password}
                                        disabled={!checkedFields.password}
                                    />
                                </div>
                            </div>


                            <div className=" w-1/3 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkGender"
                                    name="gender"
                                    checked={checkedFields.gender}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="gender"
                                           className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                    <select
                                        id="gender"
                                        name="gender"
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.gender}
                                        disabled={!checkedFields.gender}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 space-x-2">
                            <div className="col-span-2 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkAddress"
                                    name="date_joined"
                                    checked={checkedFields.date_joined}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="address"
                                           className="block text-sm font-medium text-gray-700 mb-1">Registered
                                        at</label>
                                    <input
                                        type="datetime-local"
                                        id="date_joined"
                                        name="date_joined"
                                        value={formatDateForInput(formData.date_joined)}
                                        max={new Date().toISOString().slice(0, 16)}
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.date_joined}
                                        disabled={!checkedFields.date_joined}
                                    />
                                </div>
                            </div>

                            <div className="col-span-2 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkEmail"
                                    name="email"
                                    checked={checkedFields.email}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="email"
                                           className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        placeholder="Enter patient's email"
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.email}
                                        disabled={!checkedFields.email}
                                    />
                                </div>
                            </div>
                        </div>


                        <div className="grid grid-cols-3 space-x-2">

                            <div className="col-span-2 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkCniNumber"
                                    name="cniNumber"
                                    checked={checkedFields.cniNumber}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="cniNumber" className="block text-sm font-medium text-gray-700 mb-1">Identity
                                        Card Number</label>
                                    <input
                                        type="text"
                                        id="cniNumber"
                                        name="cniNumber"
                                        value={formData.cniNumber}
                                        placeholder="Enter patient's identity card number"
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.cniNumber}
                                        disabled={!checkedFields.cniNumber}
                                    />
                                </div>
                            </div>


                            <div className="col-span-1 flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="checkGender"
                                    name="role"
                                    checked={checkedFields.role}
                                    onChange={handleCheckboxChange}
                                    className={applyCheckboxStyle()}
                                />
                                <div className="flex-1">
                                    <label htmlFor="gender"
                                           className="block text-sm font-medium text-gray-700 mb-1">Profession</label>
                                    <select
                                        id="role"
                                        name="role"
                                        onChange={handleChange}
                                        className={applyFormStyle()}
                                        required={checkedFields.role}
                                        disabled={!checkedFields.role}
                                    >
                                        <option value={formData.role}>{formData.role}</option>
                                        <option value="Pharmacist">Pharmacist</option>
                                        <option value="Receptionist">Receptionist</option>
                                        <option value="Doctor">Doctor</option>
                                        <option value="Laboratory Assistant">Laboratory Assistant</option>
                                        <option value="Accountant">Accountant</option>
                                        <option value="Nurse">Nurse</option>
                                        <option value="Dentist">Dentist</option>
                                    </select>
                                </div>
                            </div>
                        </div>


                        <div className="px-6 py-1 flex justify-center space-x-6">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-primary-end hover:text-xl text-md text-white rounded-lg font-bold transition-all duration-300"
                            >
                                Update
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setError(""),
                                    onClose()
                                }}
                                className="px-4 py-2 border bg-red-400 text-md hover:text-xl hover:bg-red-500 text-white font-bold rounded-lg transition-all duration-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}




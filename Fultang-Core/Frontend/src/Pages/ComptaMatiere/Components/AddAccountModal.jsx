"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import {
  FaTimes,
  FaSave,
  FaBan,
  FaHashtag,
  FaTag,
  FaExchangeAlt,
} from "react-icons/fa";
import axiosInstance from "../../../Utils/axiosInstanceAccountant.js";

export function AddAccountModal({
  isOpen,
  onClose,
  setCanOpenSuccessModal,
  setSuccessMessage,
  setIsLoading,
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [error, setError] = useState("");
  const [typeFlux, setTypeFlux] = useState("");
  const shouldShowTypeFlux = /^[45]/.test(accountNumber);

  // Fonction pour valider si le bouton Save doit être activé
  const isFormValid = () => {
    return (
      accountNumber &&
      accountLabel &&
      (!shouldShowTypeFlux || typeFlux) &&
      /^\d{4,}$/.test(accountNumber)
    );
  };

  const handleAddAccount = async () => {
    const shouldShowTypeFlux = /^[45]/.test(accountNumber);

    if (!accountNumber || !accountLabel || (shouldShowTypeFlux && !typeFlux)) {
      setError("All fields are required.");
      return;
    }

    if (!/^\d{4,}$/.test(accountNumber)) {
      setError(
        "The account number must contain at least 4 digits and only digits."
      );
      return;
    }

    setError("");
    setIsLoading(true);
    const accountData = {
      number: accountNumber,
      libelle: accountLabel,
    };

    if (shouldShowTypeFlux) {
      accountData.status = typeFlux;
    }

    try {
      const response = await axiosInstance.post("/account/", accountData);

      if (response.status === 201) {
        setSuccessMessage("Account added successfully!");
        setCanOpenSuccessModal(true);
        setAccountNumber("");
        setAccountLabel("");
        onClose();
      }
    } catch (error) {
      console.error("Error adding account:", error);
      setError("An error occurred while adding the account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountNumberChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setAccountNumber(value);
      if (!/^[45]/.test(value)) {
        setTypeFlux("");
      }
    }
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center bg-gradient-to-r from-primary-start to-primary-end p-4 rounded-t-lg">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FaSave className="mr-2" />
            Add New Account
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition duration-300"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Fill in the information for the new account below.
          </p>

          <div>
            <label
              htmlFor="accountNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account Number
            </label>
            <div className="relative">
              <FaHashtag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                id="accountNumber"
                type="text"
                value={accountNumber}
                onChange={handleAccountNumberChange}
                className={`w-full pl-10 pr-3 py-2 border ${
                  error ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter at least 4 digits"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="accountLabel"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account Label
            </label>
            <div className="relative">
              <FaTag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                id="accountLabel"
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                className={`w-full pl-10 pr-3 py-2 border ${
                  error ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter the account label"
              />
            </div>
          </div>

          {shouldShowTypeFlux && (
            <div>
              <label
                htmlFor="typeFlux"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Type of Flux
              </label>
              <div className="relative">
                <FaExchangeAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  id="typeFlux"
                  value={typeFlux}
                  onChange={(e) => setTypeFlux(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a type</option>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                  <option value="creance">Receivable</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end items-center rounded-b-lg">
          <button
            onClick={onClose}
            className="flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-gray-400 transition duration-300 mr-2"
          >
            <FaBan className="mr-2" />
            Cancel
          </button>
          <button
            onClick={handleAddAccount}
            disabled={!isFormValid()}
            className={`flex items-center px-4 py-2 ${
              isFormValid()
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-gray-300 text-gray-700 cursor-not-allowed"
            } rounded-md transition duration-300`}
          >
            <FaSave className="mr-2" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

AddAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  setCanOpenSuccessModal: PropTypes.func.isRequired,
  setSuccessMessage: PropTypes.func.isRequired,
  setIsLoading: PropTypes.func.isRequired,
};

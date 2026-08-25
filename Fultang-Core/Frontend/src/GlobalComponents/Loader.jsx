import PropTypes from "prop-types";

export default  function Loader ({ size , color}){

    Loader.propTypes = {
        size: PropTypes.string.isRequired,
        color: PropTypes.string.isRequired
    }
    const sizeClasses = {
        small: "w-6 h-6",
        medium: "w-12 h-12",
        large: "w-16 h-16",
    }

    return (
        <div className="flex justify-center items-center flex-col">
            <div
                className={`animate-spin rounded-full border-t-2 border-b-2 border-${color} ${sizeClasses[size]}`}></div>
                <p className="text-primary-end text-xl font-semibold animate-bounce mt-5">Loading data ... </p>
        </div>
    )
}




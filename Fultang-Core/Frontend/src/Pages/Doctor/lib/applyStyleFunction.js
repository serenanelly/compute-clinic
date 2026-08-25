export function getStateStyles  (state)  {
    const styles = {
        Critical: {
            container: "border-l-red-500",
            badge: "bg-red-100 border-red-500 text-red-500"
        },
        Serious: {
            container: "border-l-orange-500",
            badge: "bg-orange-100 border-orange-500  text-orange-500"
        },
        "Not Critical": {
            container: "border-l-yellow-500",
            badge: "bg-yellow-100 border-yellow-500 text-yellow-500"
        },
        Stable: {
            container: "border-l-green-500",
            badge: "bg-green-100 border-green-500 text-green-500"
        },
        Improving: {
            container: "border-l-blue-500",
            badge: "bg-blue-100 border-blue-500 text-blue-500"
        }
    };

    return styles[state] || { container: "border-l-gray-300", badge: "bg-gray-100 border-gray-600 text-gray-600" };
}
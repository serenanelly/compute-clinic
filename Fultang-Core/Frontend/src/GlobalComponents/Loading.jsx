
export function Loading()
{
    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-primary-start to-primary-end opacity-75">
            <div className="text-center">
                {/* animated logo */}
                <div className="inline-block animate-spin ">
                    <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>

                {/* text loading */}
                <h2 className="mt-4 text-2xl font-semibold text-white animate-pulse">
                    Loading...
                </h2>

                {/* Points de chargement animés */}
                <div className="mt-4 flex justify-center space-x-2">
                    {[0, 1, 2].map((index) => (
                        <div
                            key={index}
                            className="w-3 h-3 bg-white rounded-full animate-bounce"
                            style={{animationDelay: `${index * 0.2}s`}}
                        ></div>
                    ))}
                </div>
            </div>
        </div>
    )
}
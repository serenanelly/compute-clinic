export function calculateNumberOfSlides(totalItems, itemsPerSlide = 5) {
    return totalItems % itemsPerSlide === 0
        ? totalItems / itemsPerSlide
        : Math.floor(totalItems / itemsPerSlide) + 1;
}



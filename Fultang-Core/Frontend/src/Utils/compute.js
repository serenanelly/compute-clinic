export function useCalculateAge() {



    function calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        const diffTime = Math.abs(today - birth);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 7) {
            return { value: diffDays, unit: "day(s)" };
        } else if (diffDays < 30) {
            return { value: Math.floor(diffDays / 7), unit: "week(s)" };
        } else if (diffDays < 365) {
            return { value: Math.floor(diffDays / 30), unit: "month(s)" };
        } else {
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return { value: age, unit: "year(s)" };
        }
    }


    return { calculateAge };
}

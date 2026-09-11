import PropTypes from 'prop-types';
import { PROFESSIONS_PRESET, PROFESSION_AUTRE } from '../constants/patientProfessions.js';

export default function ProfessionSelect({
    professionSelect,
    professionAutre,
    onSelectChange,
    onAutreChange,
    errors = {},
    disabled = false,
    required = false,
    inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl',
    idPrefix = 'profession',
}) {
    ProfessionSelect.propTypes = {
        professionSelect: PropTypes.string,
        professionAutre: PropTypes.string,
        onSelectChange: PropTypes.func.isRequired,
        onAutreChange: PropTypes.func.isRequired,
        errors: PropTypes.object,
        disabled: PropTypes.bool,
        required: PropTypes.bool,
        inputClass: PropTypes.string,
        idPrefix: PropTypes.string,
    };

    return (
        <div className="space-y-2">
            <label htmlFor={`${idPrefix}_select`} className="block text-sm font-semibold text-gray-700">
                Profession
                {required && <span className="text-red-500"> *</span>}
            </label>
            <select
                id={`${idPrefix}_select`}
                name="profession_select"
                value={professionSelect || ''}
                onChange={onSelectChange}
                disabled={disabled}
                className={`${inputClass} ${errors.profession_select ? 'border-red-500 bg-red-50' : ''}`}
            >
                <option value="">Sélectionner un métier…</option>
                {PROFESSIONS_PRESET.map((p) => (
                    <option key={p} value={p}>
                        {p === PROFESSION_AUTRE ? 'Autre (préciser)' : p}
                    </option>
                ))}
            </select>
            {errors.profession_select && (
                <p className="text-red-500 text-xs">{errors.profession_select}</p>
            )}
            {professionSelect === PROFESSION_AUTRE && (
                <div>
                    <input
                        id={`${idPrefix}_autre`}
                        name="profession_autre"
                        value={professionAutre || ''}
                        onChange={onAutreChange}
                        disabled={disabled}
                        className={`${inputClass} ${errors.profession_autre ? 'border-red-500 bg-red-50' : ''}`}
                        placeholder="Précisez la profession"
                    />
                    {errors.profession_autre && (
                        <p className="text-red-500 text-xs mt-1">{errors.profession_autre}</p>
                    )}
                </div>
            )}
        </div>
    );
}

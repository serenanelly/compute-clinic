/** Calendrier unifié Ant Design fr-FR (CORR-A4-011). */
import PropTypes from 'prop-types';
import { DatePicker, ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

export function FultangDatePicker({ value, onChange, className, placeholder, disabled, id }) {
    const dayjsValue = value ? (dayjs.isDayjs(value) ? value : dayjs(value)) : null;
    return (
        <ConfigProvider locale={frFR}>
            <DatePicker
                id={id}
                className={className || 'w-full'}
                format="DD/MM/YYYY"
                placeholder={placeholder || 'JJ/MM/AAAA'}
                value={dayjsValue}
                onChange={onChange}
                disabled={disabled}
            />
        </ConfigProvider>
    );
}

FultangDatePicker.propTypes = {
    value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    onChange: PropTypes.func,
    className: PropTypes.string,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool,
    id: PropTypes.string,
};

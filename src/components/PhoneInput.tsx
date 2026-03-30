"use client";

import PhoneInputLib, { isValidPhoneNumber as isValidPhone } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Check, AlertCircle } from "lucide-react";

interface PhoneInputProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    compact?: boolean;
}

export function PhoneInput({ value, onChange, placeholder, className = "", compact = false }: PhoneInputProps) {
    const isValid = value ? isValidPhone(value) : false;
    const showValidation = value && value.length > 5;

    return (
        <div className={`relative ${className}`}>
            <style>{`
                .PhoneInput {
                    display: flex;
                    align-items: center;
                }
                .PhoneInputCountry {
                    margin-right: ${compact ? '0.35rem' : '0.5rem'};
                    padding: 0 ${compact ? '0.25rem' : '0.35rem'};
                }
                .PhoneInputCountryIcon {
                    width: ${compact ? '1.1rem' : '1.25rem'};
                    height: ${compact ? '0.8rem' : '0.9rem'};
                }
                .PhoneInputInput {
                    flex: 1;
                    min-width: 0;
                    padding: ${compact ? '0.375rem 1.5rem 0.375rem 0.5rem' : '0.625rem 2rem 0.625rem 0.75rem'};
                    border-radius: ${compact ? '0.375rem' : '0.75rem'};
                    border: 1px solid hsl(var(--border));
                    font-size: ${compact ? '11px' : '0.875rem'};
                    line-height: 1.5rem;
                    outline: none;
                    transition: all 0.2s;
                    background-color: hsl(var(--secondary));
                    color: hsl(var(--foreground));
                }
                .PhoneInputInput::placeholder {
                    color: hsl(var(--muted-foreground));
                }
                .PhoneInputInput:focus {
                    border-color: rgb(16 185 129 / 0.5);
                    box-shadow: 0 0 0 1px rgb(16 185 129 / 0.2);
                }
                .PhoneInputCountrySelect {
                    background: hsl(var(--card));
                    color: hsl(var(--foreground));
                }
                .PhoneInputCountrySelectArrow {
                    color: hsl(var(--muted-foreground));
                    opacity: 0.6;
                }
            `}</style>
            <PhoneInputLib
                international
                defaultCountry="BR"
                countryCallingCodeEditable={false}
                limitMaxLength
                value={value}
                onChange={(v) => onChange(v || "")}
                placeholder={placeholder || "(11) 99999-9999"}
            />
            {showValidation && (
                <div className={`absolute ${compact ? 'right-1 top-1/2 -translate-y-1/2' : 'right-2 top-1/2 -translate-y-1/2'}`}>
                    {isValid ? (
                        <Check className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-500`} />
                    ) : (
                        <AlertCircle className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-red-400`} />
                    )}
                </div>
            )}
        </div>
    );
}

export function isValidPhoneNumber(value: string | undefined): boolean {
    if (!value) return false;
    return isValidPhone(value);
}

/**
 * Utilitaire pour récupérer le token JWT stocké en localStorage.
 * Utilisé par les instances axios pour l'injection dynamique du token.
 */

export function getToken() {
    return localStorage.getItem('token_key_fultang');
}

export function getRefreshToken() {
    return localStorage.getItem('refresh_token_fultang');
}

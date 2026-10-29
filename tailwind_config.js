tailwind.config = {
    theme: {
        extend: {
            colors: {
                metal: {
                    900: '#121316',
                    800: '#1b1d22',
                    700: '#282c34',
                    600: '#3a3f4d',
                    500: '#4e5566',
                },
                brass: {
                    DEFAULT: '#c5a059',
                    light: '#e5c178',
                    dark: '#947232',
                    glow: 'rgba(197, 160, 89, 0.4)'
                },
                amberGlow: '#ffb000',
            },
            fontFamily: {
                mono: ['"Share Tech Mono"', 'monospace'],
                typewriter: ['"Courier Prime"', 'monospace'],
                vintage: ['"Special Elite"', 'cursive'],
            }
        }
    }
}
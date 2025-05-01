function signIn() {
    console.log('signIn function called'); // Debug log
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    if (!email || !password) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Please enter both email and password';
        return;
    }

    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            console.log('Login successful:', userCredential.user.email); // Debug log
            return userCredential.user.getIdToken();
        })
        .then(idToken => {
            console.log('ID token obtained:', idToken); // Debug log
            document.cookie = `id_token=${idToken}; path=/`;
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Login error:', error); // Debug log
            errorMessage.style.display = 'block';
            errorMessage.textContent = error.message;
        });
}
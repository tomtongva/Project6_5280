$('#login-form').submit(function(e) {
    e.preventDefault();
    let username = $('#username').val();
    let password = $('#password').val()
    fetch('/login', {
        method: 'POST',
        mode: 'same-origin',
        redirect: 'follow',
        credentials: 'include', 
        headers: {
            'Content-Type': 'application/json'
          },
        body: JSON.stringify({
            username: username,
            password: password
        })
    }).then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        }
    })

});

$('#logout').click(function(e) {
    fetch('/logout', {
        method: 'POST',
        mode: 'same-origin',
        redirect: 'follow',
        credentials: 'include'
    }).then(response => {
        if (response.redirected) {
            window.location.href = response.url;
        }
    })
});
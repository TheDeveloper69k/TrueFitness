// otp-patch.js
// Drop this file in your js/ folder
// Add <script src="js/otp-patch.js"></script> as the LAST script in index.html
// This completely overrides sendOtpSignup with a working version

window.addEventListener("load", function () {

    // Override sendOtpSignup completely
    window.sendOtpSignup = async function () {

        var name = document.getElementById("signupName").value.trim();
        var phone = document.getElementById("signupPhone").value.trim();
        var pass = document.getElementById("signupPass").value.trim();
        var confirm = document.getElementById("signupConfirm").value.trim();

        // Clear error
        var errEl = document.getElementById("signupErr");
        if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }

        if (!name) return showErr("Please enter your full name.");
        if (phone.length < 10) return showErr("Enter a valid 10-digit phone number.");
        if (pass.length < 6) return showErr("Password must be at least 6 characters.");
        if (pass !== confirm) return showErr("Passwords do not match.");

        var btn = document.getElementById("sendOtpBtn");
        if (btn) { btn.textContent = "Sending…"; btn.disabled = true; }

        // ══ FORCE SHOW OTP BOX — guaranteed ══
        showBox();

        // Call API
        var res = await sendRegisterOTP(phone, name, pass);

        if (!res.ok) {
            showErr(res.msg);
            if (btn) { btn.textContent = "Retry"; btn.disabled = false; }
            return;
        }

        if (btn) btn.textContent = "OTP Sent ✓";

        var otpInput = document.getElementById("signupOtp");
        if (otpInput) otpInput.value = "";

        startOtpCountdown(30);
    };

    function showBox() {
        var box = document.getElementById("otpVerifyGroup");
        if (!box) { alert("ERROR: otpVerifyGroup not found! Check your HTML."); return; }

        // Nuclear: set attribute directly — bypasses everything
        box.setAttribute("style",
            "display:block!important;" +
            "visibility:visible!important;" +
            "opacity:1!important;" +
            "height:auto!important;" +
            "overflow:visible!important;" +
            "margin-top:8px;margin-bottom:8px;"
        );

        // Double-tap via cssText
        box.style.cssText =
            "display:block!important;" +
            "visibility:visible!important;" +
            "opacity:1!important;" +
            "height:auto!important;" +
            "overflow:visible!important;" +
            "margin-top:8px;margin-bottom:8px;";

        setTimeout(function () {
            var inp = document.getElementById("signupOtp");
            if (inp) inp.focus();
            box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
    }

    function showErr(msg) {
        var errEl = document.getElementById("signupErr");
        if (!errEl) { alert(msg); return; }
        errEl.textContent = msg;
        errEl.style.display = "block";
        setTimeout(function () { errEl.style.display = "none"; }, 3500);
    }

    console.log("✅ otp-patch.js loaded — sendOtpSignup overridden");
});
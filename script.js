import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBuApJZcXE60yFqlFL_Bm3jmxmgrV6q2Yg",
    authDomain: "myshop-f14a0.firebaseapp.com",
    projectId: "myshop-f14a0",
    storageBucket: "myshop-f14a0.firebasestorage.app",
    messagingSenderId: "384247492467",
    appId: "1:384247492467:web:a681b581d2936f0b6c1f06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let products = [];
let billItems = JSON.parse(localStorage.getItem('currentCart')) || [];
let currentUser = null;

// Check Login Status
onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

// Navigation & Logic
window.openCart = () => {
    document.getElementById('cart-sidebar').classList.add('active');
    history.pushState({ cartOpen: true }, "");
};
window.closeCart = () => {
    document.getElementById('cart-sidebar').classList.remove('active');
    if (history.state && history.state.cartOpen) history.back();
};
window.onpopstate = () => document.getElementById('cart-sidebar').classList.remove('active');

async function loadProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        products = [];
        querySnapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        renderProducts();
        updateBillDisplay();
    } catch (e) { console.error("Load failed:", e); }
}

function renderProducts(query = "") {
    const list = document.getElementById('product-list');
    list.innerHTML = '';
    products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            <img src="${p.image || 'https://via.placeholder.com/150'}" class="product-image">
            <h4>${p.name}</h4><p>₹${p.price}</p>
            <button onclick="window.addToBill('${p.id}')">Add</button>
        `;
        list.appendChild(div);
    });
}

window.addToBill = (id) => {
    const p = products.find(i => i.id === id);
    const existing = billItems.find(i => i.id === id);
    if (existing) existing.qty += 1;
    else billItems.push({ ...p, qty: 1 });
    updateBillDisplay();
    window.openCart();
};

window.updateItemQuantity = (id, val) => {
    const item = billItems.find(i => i.id === id);
    if (val === "custom") { if (item.qty <= 10) item.qty = 11; }
    else item.qty = Number(val);
    updateBillDisplay();
};

window.removeFromBill = (id) => {
    billItems = billItems.filter(i => i.id !== id);
    updateBillDisplay();
};

window.applyDiscount = () => updateBillDisplay();

function updateBillDisplay() {
    const body = document.getElementById('bill-items');
    let subtotal = 0; let totalQty = 0;
    body.innerHTML = '';
    localStorage.setItem('currentCart', JSON.stringify(billItems));

    billItems.forEach(item => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal; totalQty += Number(item.qty);
        body.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>
                    <select onchange="window.updateItemQuantity('${item.id}', this.value)">
                        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${item.qty == n ? 'selected' : ''}>${n}</option>`).join('')}
                        <option value="custom" ${item.qty > 10 ? 'selected' : ''}>10+</option>
                    </select>
                    ${item.qty > 10 ? `<input type="number" value="${item.qty}" style="width:50px;display:block;margin-top:5px" onchange="window.updateItemQuantity('${item.id}', this.value)">` : ''}
                </td>
                <td>₹${item.price}</td><td>₹${lineTotal}</td>
                <td><button class="remove-btn" onclick="window.removeFromBill('${item.id}')">X</button></td>
            </tr>
        `;
    });
    const disc = Number(document.getElementById('discount-input').value || 0);
    document.getElementById('grand-total').innerText = Math.max(0, subtotal - disc);
    document.getElementById('cart-badge').innerText = totalQty;
}

window.finalizeSale = async function() {
    if (!billItems.length) return;
    
    // If not logged in, ask for login before saving sale
    if (!currentUser) {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            alert("Login required to complete sale.");
            return;
        }
    }

    const sale = {
        date: new Date().toLocaleString(),
        total: Number(document.getElementById('grand-total').innerText),
        items: billItems,
        customerName: document.getElementById('cust-name').value || "Guest",
        phone: document.getElementById('cust-phone').value || "N/A"
    };
    
    try {
        await addDoc(collection(db, "sales"), sale);
        billItems = []; localStorage.removeItem('currentCart');
        updateBillDisplay();
        document.getElementById('cart-sidebar').classList.remove('active');
        alert("Sale Completed!");
    } catch (e) { alert("Error saving sale. Make sure you are logged in."); }
};

document.getElementById('search-box').addEventListener('input', e => renderProducts(e.target.value));
loadProducts();

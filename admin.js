import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
// NEW: Import Authentication modules
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
const auth = getAuth(app); // Initialize Auth
const provider = new GoogleAuthProvider(); // Initialize Google Login

let products = [];
let salesHistory = [];

// --- NEW: Authentication Guard ---
// This checks if you are logged in before trying to load data
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Logged in as:", user.email);
        loadCloudData(); // Only run this if we are authenticated
    } else {
        // If not logged in, show the Google Login popup
        signInWithPopup(auth, provider).catch(error => {
            alert("Access Denied. You must login to manage the shop: " + error.message);
        });
    }
});

async function loadCloudData() {
    try {
        products = [];
        const prodSnapshot = await getDocs(collection(db, "products"));
        prodSnapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        renderInventory();

        salesHistory = [];
        const salesSnapshot = await getDocs(collection(db, "sales"));
        salesSnapshot.forEach((doc) => salesHistory.push({ id: doc.id, ...doc.data() }));
        
        renderTopItems();
        renderSalesAndAnalytics();
    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Permission Denied. Make sure you are logged in with the correct account.");
    }
}

// ... Keep your existing renderInventory, renderTopItems, etc. exactly the same ...

function renderInventory(filterText = "") {
    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = '';
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach(product => {
        const imgSrc = product.image ? product.image : 'https://via.placeholder.com/50?text=No+Img';
        inventoryList.innerHTML += `
            <tr>
                <td><img src="${imgSrc}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td>${product.name}</td>
                <td>₹${product.price}</td>
                <td>
                    <button onclick="window.editProduct('${product.id}')" style="background:#f39c12; margin-top:0;">Edit</button>
                    <button onclick="window.deleteProduct('${product.id}')" style="background:#e74c3c; margin-top:0;">Delete</button>
                </td>
            </tr>
        `;
    });
}

document.getElementById('inventory-search')?.addEventListener('input', (e) => {
    renderInventory(e.target.value);
});

const form = document.getElementById('product-form');
if(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const idField = document.getElementById('edit-id').value;
        const name = document.getElementById('prod-name').value;
        const price = document.getElementById('prod-price').value;
        const imageFile = document.getElementById('prod-image').files[0];
        document.getElementById('submit-btn').innerText = 'Saving...';

        const processSave = async (imageBase64) => {
            const productData = { name: name, price: Number(price) };
            if (imageBase64) productData.image = imageBase64;

            try {
                if (idField) {
                    await updateDoc(doc(db, "products", idField), productData);
                } else {
                    await addDoc(collection(db, "products"), productData);
                }
                form.reset();
                document.getElementById('edit-id').value = '';
                document.getElementById('submit-btn').innerText = 'Save Product';
                loadCloudData();
            } catch (e) {
                alert("Error saving to cloud. Check if you are logged in.");
            }
        };

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = e => processSave(e.target.result);
            reader.readAsDataURL(imageFile);
        } else {
            processSave(null);
        }
    });
}

window.deleteProduct = async function(id) {
    if(confirm("Delete product?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            loadCloudData();
        } catch(e) { alert("Delete failed. Check permissions."); }
    }
}

window.editProduct = function(id) {
    const product = products.find(p => p.id === id);
    document.getElementById('edit-id').value = product.id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('submit-btn').innerText = 'Update Product';
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function renderTopItems() {
    let itemCounts = {};
    salesHistory.forEach(sale => {
        if(sale.items) {
            sale.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.qty || 0);
            });
        }
    });
    let sorted = Object.keys(itemCounts).map(n => ({name: n, qty: itemCounts[n]}))
                 .sort((a,b) => b.qty - a.qty).slice(0, 5);
    const list = document.getElementById('top-items-list');
    if(list) {
        list.innerHTML = sorted.map(i => `<tr><td>${i.name}</td><td><strong>${i.qty}</strong> units</td></tr>`).join('');
    }
}

let salesChartInstance = null;
function renderSalesAndAnalytics() {
    const list = document.getElementById('sales-list');
    if(!list) return;
    const today = new Date().toLocaleDateString();
    let tCust = 0, tRev = 0, allRev = 0;
    const weekData = {};
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate()-i);
        weekData[d.toLocaleDateString()] = 0;
    }
    list.innerHTML = '';
    salesHistory.forEach(s => {
        const amt = Number(s.totalAmount || s.total || 0);
        allRev += amt;
        const dStr = s.dateOnly || (s.date ? s.date.split(',')[0] : s.fullDate?.split(',')[0]);
        if(dStr === today) { tCust++; tRev += amt; }
        if(weekData[dStr] !== undefined) weekData[dStr] += amt;
        list.innerHTML += `<tr><td>${s.fullDate || s.date}</td><td>${s.customerName || s.customer}</td><td>${s.phone}</td><td>₹${amt}</td></tr>`;
    });
    document.getElementById('today-customers').innerText = tCust;
    document.getElementById('today-revenue').innerText = tRev;
    document.getElementById('total-revenue').innerText = allRev;
    const ctx = document.getElementById('salesChart').getContext('2d');
    if(salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(weekData), datasets: [{ label: 'Revenue (₹)', data: Object.values(weekData), backgroundColor: '#3498db' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

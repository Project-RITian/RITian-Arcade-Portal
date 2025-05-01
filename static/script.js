document.addEventListener('DOMContentLoaded', function () {
    fetch('/fetch_arcade_orders')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(orders => {
            const ordersContainer = document.getElementById('xerox-orders');
            ordersContainer.innerHTML = '';

            // Filter out orders where stationeryItems is not null or empty
            const xeroxOrders = orders.filter(order => !order.stationeryItems || order.stationeryItems.length === 0);

            xeroxOrders.forEach(order => {
                const xeroxDetails = order.xeroxDetails || {};
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                orderCard.id = `order-${order.order_id}`; // Add an ID to the card for easy removal
                orderCard.innerHTML = `
                    <h3>#${order.pin || 'N/A'} - ${xeroxDetails.fileName || 'Unknown File'}</h3>
                    <p>Instructions: ${xeroxDetails.customInstructions || 'N/A'}</p>
                    <p>Copies: ${xeroxDetails.copies || 'N/A'}</p>
                    <p>Print Side: ${xeroxDetails.printSide || 'N/A'}</p>
                    <p>Print Type: ${xeroxDetails.printType || 'N/A'}</p>
                    <p>Timestamp: ${order.timestamp || 'N/A'}</p>
                    <button class="download-btn" onclick="downloadXeroxFile('${order.order_id || 'N/A'}', '${xeroxDetails.fileName || 'Unknown File'}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="view-btn" onclick="openFile('${xeroxDetails.fileUrl || ''}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="print-btn" onclick="printXeroxFile('${order.order_id || 'N/A'}', '${xeroxDetails.fileName || 'Unknown File'}')">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button class="complete-btn" onclick="completeXeroxOrder('${order.order_id || 'N/A'}', 'order-${order.order_id}')">
                        <i class="fas fa-check"></i> Mark as Completed
                    </button>
                `;
                ordersContainer.appendChild(orderCard);
            });

            // Display a message if no Xerox orders are found
            if (xeroxOrders.length === 0) {
                ordersContainer.innerHTML = '<p>No Xerox orders found.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching orders:', error);
            const ordersContainer = document.getElementById('xerox-orders');
            ordersContainer.innerHTML = `<p class="error">Error loading orders: ${error.message}</p>`;
        });
});

function completeXeroxOrder(orderId, cardId) {
    const orderCard = document.getElementById(cardId);
    orderCard.innerHTML = '<p>Processing...</p>'; // Show a loading state

    // Step 1: Delete the order from Firestore
    fetch(`/delete_xerox_order/${orderId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Order deleted from Firestore:', data);

            // Step 2: Delete the file from Firebase Storage using user_id and file_name from response
            const userId = data.user_id;
            const fileName = data.file_name;
            
            if (!userId || !fileName) {
                throw new Error('Missing user_id or file_name in response');
            }

            return fetch(`/delete_xerox_file/${userId}/${encodeURIComponent(fileName)}`, {
                method: 'DELETE'
            });
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('File deleted from Firebase Storage:', data);

            // Step 3: Remove the order card from the UI
            const orderCard = document.getElementById(cardId);
            if (orderCard) {
                orderCard.remove();
            }

            // Check if there are any remaining orders
            const ordersContainer = document.getElementById('xerox-orders');
            if (ordersContainer.children.length === 0) {
                ordersContainer.innerHTML = '<p>No Xerox orders found.</p>';
            }
            
            // Show success message
            alert('Order marked as complete successfully!');
        })
        .catch(error => {
            console.error('Error completing Xerox order:', error);
            
            // Restore the order card with error message
            const orderCard = document.getElementById(cardId);
            if (orderCard) {
                // Get the original order details to restore the card
                fetch(`/fetch_arcade_orders`)
                    .then(response => response.json())
                    .then(orders => {
                        const order = orders.find(o => o.order_id === orderId);
                        if (order) {
                            const xeroxDetails = order.xeroxDetails || {};
                            orderCard.innerHTML = `
                                <h3>#${order.pin || 'N/A'} - ${xeroxDetails.fileName || 'Unknown File'}</h3>
                                <p>Instructions: ${xeroxDetails.customInstructions || 'N/A'}</p>
                                <p>Copies: ${xeroxDetails.copies || 'N/A'}</p>
                                <p>Print Side: ${xeroxDetails.printSide || 'N/A'}</p>
                                <p>Print Type: ${xeroxDetails.printType || 'N/A'}</p>
                                <p>Timestamp: ${order.timestamp || 'N/A'}</p>
                                <p class="error">Error: ${error.message}</p>
                                <button class="download-btn" onclick="downloadXeroxFile('${order.order_id || 'N/A'}', '${xeroxDetails.fileName || 'Unknown File'}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button class="view-btn" onclick="openFile('${xeroxDetails.fileUrl || ''}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="print-btn" onclick="printXeroxFile('${order.order_id || 'N/A'}', '${xeroxDetails.fileName || 'Unknown File'}')">
                                    <i class="fas fa-print"></i> Print
                                </button>
                                <button class="complete-btn" onclick="completeXeroxOrder('${order.order_id || 'N/A'}', 'order-${order.order_id}')">
                                    <i class="fas fa-check"></i> Mark as Completed
                                </button>
                            `;
                        } else {
                            orderCard.innerHTML = `<p class="error">Error completing order: ${error.message}</p>`;
                        }
                    })
                    .catch(() => {
                        orderCard.innerHTML = `<p class="error">Error completing order: ${error.message}</p>`;
                    });
            }
            
            alert(`Error completing order: ${error.message}`);
        });
}

// Existing functions (unchanged)
function toggleNotifications() {
    const dropdown = document.querySelector('.notification-dropdown');
    dropdown.classList.toggle('show');
}

function changeProfilePicture() {
    document.getElementById('profile-upload').click();
}

function changeLogo() {
    document.getElementById('logo-upload').click();
}

function signOut() {
    window.location.href = '/';
}

function fetchOrderByPin() {
    const pinInput = document.getElementById('pin-input').value;
    const orderContainer = document.getElementById('stationery-order-details');

    if (!pinInput.match(/^\d{3}$/)) {
        orderContainer.innerHTML = '<p class="error">Please enter a valid 3-digit PIN</p>';
        return;
    }

    fetch(`/fetch_stationery_order_by_pin/${pinInput}`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Order not found for this PIN');
                } else if (response.status === 400) {
                    throw new Error('Invalid PIN format');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            return response.json();
        })
        .then(order => {
            console.log('Fetched order:', order);
            orderContainer.innerHTML = '';

            if (!order || !order.stationeryItems || order.stationeryItems.length === 0) {
                orderContainer.innerHTML = '<p>No order found for this PIN</p>';
                return;
            }

            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';

            const itemsList = order.stationeryItems
                .map(item => item.name || 'Unknown Item')
                .join(', ');

            const totalQuantity = order.stationeryItems
                .reduce((sum, item) => sum + (item.quantity || 0), 0);

            orderCard.innerHTML = `
                <h3>#${order.pin || 'N/A'}</h3>
                <p>Items: ${itemsList}</p>
                <p>Total Items: ${totalQuantity}</p>
                <p>Total Cost: ₹${order.totalCost || '0'}</p>
                <p>Date: ${order.timestamp || 'N/A'}</p>
                <div class="order-actions">
                    <button class="print-btn" onclick="printStationeryReceipt(
                        '${order.order_id}', 
                        '${itemsList.replace(/'/g, "\\'")}', 
                        ${totalQuantity}, 
                        ${order.totalCost}, 
                        '${order.timestamp}'
                    )">
                        <i class="fas fa-print"></i> Print Receipt
                    </button>
                    <button class="deliver-btn" onclick="deliverOrder('${order.order_id}')">
                        <i class="fas fa-check"></i> Deliver Order
                    </button>
                </div>
            `;
            orderContainer.appendChild(orderCard);
        })
        .catch(error => {
            console.error('Error fetching order:', error);
            orderContainer.innerHTML = `<p class="error">Error loading order: ${error.message}</p>`;
        });
}

function deliverOrder(orderId) {
    fetch(`/delete_stationery_order/${orderId}`, {
        method: 'DELETE'
    })
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Order not found');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            return response.json();
        })
        .then(data => {
            console.log('Order delivered:', data);
            const orderContainer = document.getElementById('stationery-order-details');
            orderContainer.innerHTML = '<p>Order delivered successfully</p>';
            document.getElementById('pin-input').value = '';
        })
        .catch(error => {
            console.error('Error delivering order:', error);
            const orderContainer = document.getElementById('stationery-order-details');
            orderContainer.innerHTML = `<p class="error">Error delivering order: ${error.message}</p>`;
        });
}

function printStationeryReceipt(orderId, itemName, quantity, totalCost, timestamp) {
    const printWindow = window.open('', '_blank');
    const formattedDate = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt for Order #${orderId}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1, h2 { color: #333; text-align: center; }
                    .receipt { border: 1px solid #ddd; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .item-details { margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    .total { font-weight: bold; font-size: 1.1em; }
                    .thank-you { text-align: center; margin-top: 20px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <h1>College Stationery</h1>
                    <h2>Order Receipt</h2>
                    <div class="item-details">
                        <p><strong>Order ID:</strong> #${orderId}</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${itemName}</td>
                                <td>${quantity}</td>
                                <td>₹${totalCost}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="total">Total Amount: ₹${totalCost}</div>
                    <div class="thank-you">Thank you for your order!</div>
                </div>
                <script>
                    window.print();
                    setTimeout(() => { window.close(); }, 1000);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function openFile(fileUrl) {
    if (fileUrl && fileUrl.trim() !== '') {
        try {
            new URL(fileUrl);
            window.open(fileUrl, '_blank');
        } catch (e) {
            console.error('Invalid file URL:', fileUrl, e);
            alert('Invalid file URL. Please check the order details.');
        }
    } else {
        console.error('File URL is missing or empty');
        alert('File not available for this order.');
    }
}

document.getElementById('profile-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('profile-upload', file);

        fetch('/upload_profile', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.filename) {
                document.getElementById('profile-pic').src = `/Uploads/profile/${data.filename}`;
            } else {
                alert('Error uploading profile picture');
            }
        })
        .catch(error => {
            console.error('Error uploading profile picture:', error);
            alert(`Error uploading profile picture: ${error.message}`);
        });
    }
});

document.getElementById('logo-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('logo-upload', file);

        fetch('/upload_logo', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.filename) {
                document.getElementById('college-logo').src = `/Uploads/logo/${data.filename}`;
            } else {
                alert('Error uploading logo');
            }
        })
        .catch(error => {
            console.error('Error uploading logo:', error);
            alert(`Error uploading logo: ${error.message}`);
        });
    }
});

function downloadXeroxFile(orderId, orderName) {
    window.location.href = `/download_xerox/${orderId}/${encodeURIComponent(orderName)}`;
}

function printXeroxFile(orderId, orderName) {
    fetch(`/print_xerox/${orderId}/${encodeURIComponent(orderName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <body>
                        <h1>Printing Order #${orderId} - ${orderName}</h1>
                        <p>This is a dummy print preview.</p>
                        <script>window.print(); window.close();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        })
        .catch(error => {
            console.error('Error initiating print:', error);
            alert(`Error initiating print: ${error.message}`);
        });
}
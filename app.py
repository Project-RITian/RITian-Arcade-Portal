from flask import Flask, render_template, request, send_file, jsonify, redirect, url_for
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import firebase_admin
from firebase_admin import credentials, firestore, storage
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Firebase Admin SDK initialization
cred = credentials.Certificate('firebase_service_account.json')
firebase_admin.initialize_app(cred, {
    # Replace with your actual Firebase Storage bucket name
    'storageBucket': 'ritian.firebasestorage.app'
})
db = firestore.client()
bucket = storage.bucket()

# Configuration
UPLOAD_FOLDER = 'Uploads'
LOGO_FOLDER = os.path.join(UPLOAD_FOLDER, 'logo')
PROFILE_FOLDER = os.path.join(UPLOAD_FOLDER, 'profile')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['LOGO_FOLDER'] = LOGO_FOLDER
app.config['PROFILE_FOLDER'] = PROFILE_FOLDER

# Ensure upload directories exist
os.makedirs(LOGO_FOLDER, exist_ok=True)
os.makedirs(PROFILE_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Hardcoded user ID to simulate authenticated user
HARDCODED_USER_ID = "admin_user"


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    # Directly render the homepage without authentication
    return render_template('index.html')


@app.route('/fetch_arcade_orders')
def fetch_arcade_orders():
    try:
        users_ref = db.collection('users')
        users = users_ref.stream()

        arcade_orders = []
        for user in users:
            user_id = user.id
            purchases_ref = users_ref.document(user_id).collection('purchases')
            purchases = purchases_ref.where('type', '==', 'arcade').stream()

            for purchase in purchases:
                purchase_data = purchase.to_dict()
                purchase_data['order_id'] = purchase.id
                purchase_data['user_id'] = user_id
                arcade_orders.append(purchase_data)

        return jsonify(arcade_orders), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/fetch_stationery_orders')
def fetch_stationery_orders():
    try:
        users_ref = db.collection('users')
        users = users_ref.stream()

        stationery_orders = []
        for user in users:
            user_id = user.id
            purchases_ref = users_ref.document(user_id).collection('purchases')
            purchases = purchases_ref.where(
                'stationeryItems', '!=', None).stream()

            for purchase in purchases:
                purchase_data = purchase.to_dict()
                if 'stationeryItems' in purchase_data:
                    order_data = {
                        'order_id': purchase.id,
                        'pin': purchase_data.get('pin', ''),
                        'stationeryItems': purchase_data.get('stationeryItems', []),
                        'totalCost': purchase_data.get('totalCost', 0),
                        'timestamp': purchase_data.get('timestamp', '')
                    }
                    stationery_orders.append(order_data)

        return jsonify(stationery_orders), 200
    except Exception as e:
        print(f"Error fetching stationery orders: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/fetch_stationery_order_by_pin/<pin>')
def fetch_stationery_order_by_pin(pin):
    if not pin.isdigit() or len(pin) != 3:
        return jsonify({'error': 'Invalid PIN format'}), 400

    try:
        users_ref = db.collection('users')
        users = users_ref.stream()

        for user in users:
            user_id = user.id
            purchases_ref = users_ref.document(user_id).collection('purchases')
            purchases = purchases_ref.where('pin', '==', pin).where(
                'stationeryItems', '!=', None).stream()

            for purchase in purchases:
                purchase_data = purchase.to_dict()
                if 'stationeryItems' in purchase_data:
                    order_data = {
                        'order_id': purchase.id,
                        'pin': purchase_data.get('pin', ''),
                        'stationeryItems': purchase_data.get('stationeryItems', []),
                        'totalCost': purchase_data.get('totalCost', 0),
                        'timestamp': purchase_data.get('timestamp', '')
                    }
                    return jsonify(order_data), 200

        return jsonify({'error': 'Order not found'}), 404
    except Exception as e:
        print(f"Error fetching order by PIN: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/delete_stationery_order/<order_id>', methods=['DELETE'])
def delete_stationery_order(order_id):
    try:
        users_ref = db.collection('users')
        users = users_ref.stream()

        for user in users:
            user_id = user.id
            purchase_ref = users_ref.document(user_id).collection(
                'purchases').document(order_id)
            if purchase_ref.get().exists:
                purchase_ref.delete()
                return jsonify({'status': 'Order deleted successfully'}), 200

        return jsonify({'error': 'Order not found'}), 404
    except Exception as e:
        print(f"Error deleting order: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/delete_xerox_order/<order_id>', methods=['DELETE'])
def delete_xerox_order(order_id):
    try:
        # First check if the order exists in the purchases collection
        order_ref = db.collection('purchases').document(order_id)
        order_doc = order_ref.get()

        # If the order exists in the purchases collection
        if order_doc.exists:
            # Get the document data to extract fileName and other details
            order_data = order_doc.to_dict()
            xerox_details = order_data.get('xeroxDetails', {})
            file_name = xerox_details.get('fileName', '')
            file_url = xerox_details.get('fileUrl', '')

            # Extract user_id from the fileURL
            user_id = None
            if file_url:
                # Extract user_id from the URL (e.g., users%2F([a-zA-Z0-9_-]+)%2Fpurchases)
                match = re.search(
                    r'users%2F([a-zA-Z0-9_-]+)%2Fpurchases', file_url)
                if match:
                    user_id = match.group(1)

            # Delete the document from Firestore
            order_ref.delete()

            return jsonify({
                "message": "Order deleted successfully",
                "user_id": user_id,
                "file_name": file_name
            }), 200

        # If not found in purchases collection, try looking in all user purchase subcollections
        users_ref = db.collection('users')
        users = users_ref.stream()

        for user in users:
            user_id = user.id
            purchase_ref = users_ref.document(user_id).collection(
                'purchases').document(order_id)
            purchase_doc = purchase_ref.get()

            if purchase_doc.exists:
                # Get the document data to extract fileName and other details
                purchase_data = purchase_doc.to_dict()
                xerox_details = purchase_data.get('xeroxDetails', {})
                file_name = xerox_details.get('fileName', '')

                # Delete the document from Firestore
                purchase_ref.delete()

                return jsonify({
                    "message": "Order deleted successfully",
                    "user_id": user_id,
                    "file_name": file_name
                }), 200

        return jsonify({"error": "Order not found"}), 404
    except Exception as e:
        print(f"Error in delete_xerox_order: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/delete_xerox_file/<user_id>/<file_name>', methods=['DELETE'])
def delete_xerox_file(user_id, file_name):
    try:
        # Construct the file path in Firebase Storage
        file_path = f"users/{user_id}/purchases/{file_name}"
        print(f"Attempting to delete file at path: {file_path}")

        # Get the blob for the file
        blob = bucket.blob(file_path)

        # Check if the file exists
        if not blob.exists():
            # If the file doesn't exist at the expected path, try to find it without the full path
            # This is a fallback in case the file is stored directly in the root or another location
            all_blobs = list(bucket.list_blobs(
                prefix=f"users/{user_id}/purchases/"))
            for potential_blob in all_blobs:
                if file_name in potential_blob.name:
                    blob = potential_blob
                    file_path = potential_blob.name
                    print(f"Found file at alternative path: {file_path}")
                    break

            if not blob.exists():
                return jsonify({"error": "File not found in Firebase Storage"}), 404

        # Delete the file
        blob.delete()
        return jsonify({"message": f"File deleted successfully from path: {file_path}"}), 200

    except Exception as e:
        print(f"Error in delete_xerox_file: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/upload_profile', methods=['POST'])
def upload_profile():
    if 'profile-upload' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['profile-upload']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['PROFILE_FOLDER'], filename)
        file.save(file_path)
        return jsonify({'filename': filename}), 200
    return jsonify({'error': 'Invalid file type'}), 400


@app.route('/upload_logo', methods=['POST'])
def upload_logo():
    if 'logo-upload' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['logo-upload']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['LOGO_FOLDER'], filename)
        file.save(file_path)
        return jsonify({'filename': filename}), 200
    return jsonify({'error': 'Invalid file type'}), 400


@app.route('/download_xerox/<order_id>/<order_name>')
def download_xerox(order_id, order_name):
    order_ref = db.collection('orders').document(order_id)
    order_data = order_ref.get()
    if order_data.exists:
        file_url = order_data.to_dict().get('xeroxDetails', {}).get('fileUrl', '')
        if file_url:
            return redirect(file_url)

    return jsonify({'error': 'File not found'}), 404


@app.route('/print_xerox/<order_id>/<order_name>')
def print_xerox(order_id, order_name):
    return jsonify({'status': 'Print initiated', 'order_id': order_id, 'order_name': order_name})


if __name__ == '__main__':
    app.run(debug=True)

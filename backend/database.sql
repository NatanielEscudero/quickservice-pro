CREATE DATABASE quickservice_db;

USE quickservice_db;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role ENUM('client', 'worker', 'admin') NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    profession VARCHAR(100) NOT NULL,
    description TEXT,
    hourly_rate DECIMAL(10,2),
    immediate_service BOOLEAN DEFAULT false,
    availability ENUM('available', 'busy', 'offline') DEFAULT 'available',
    rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""
============================================================================
ARCHIVO: ./api-server/src/models/user.py
============================================================================

📥 ENTRADA DE DATOS:

🔄 TRANSFORMACIÓN:
  CLASES: User
  FUNCIONES: __repr__, to_dict

📤 SALIDA DE DATOS:

🔗 DEPENDENCIAS:
  - SQLAlchemy
  - flask_sqlalchemy

============================================================================
"""

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email
        }

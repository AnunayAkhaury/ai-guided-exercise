import sys

from PySide6.QtCore import QSize, Qt, Signal, QPoint
from PySide6.QtWidgets import QApplication, QMainWindow, QPushButton, QLabel, QVBoxLayout, QHBoxLayout, QStackedLayout, QWidget, QMenu
from PySide6.QtGui import QPixmap, QPalette, QColor


class Rect(QWidget):
    def __init__(self):
        super().__init__()
        self.setAutoFillBackground(True)

        palette = self.palette()
        palette.setColor(QPalette.ColorRole.Window, QColor(0, 255, 0, 127)) # opacity ranges from 0 - 255
        self.setPalette(palette)

        self.setFixedSize(QSize(200, 200))
        self.move(200, 200)

class AnnotatedImage(QLabel):
    def __init__(self):
        super().__init__()

        self.setPixmap(QPixmap("landmarks.png"))
        self.setScaledContents(True)

        rect = Rect()
        rect.setParent(self)

    def resizeEvent(self, event):
        super().resizeEvent(event)

        new_size = event.size()
        print("Image resized (", new_size.width(), ", ", new_size.height(), ")")
       

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("My App")
        self.setMinimumSize(QSize(400, 300))

        annotated_image = AnnotatedImage()

        layout = QVBoxLayout()
        layout.addWidget(annotated_image)

        container = QWidget()
        container.setLayout(layout)

        self.setCentralWidget(container)


app = QApplication(sys.argv)

window = MainWindow()
window.show()

app.exec()

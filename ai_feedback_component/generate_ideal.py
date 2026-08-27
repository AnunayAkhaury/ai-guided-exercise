import sys
import json
from PySide6.QtCore import QSize, Qt, Signal, QPoint
from PySide6.QtWidgets import QApplication, QMainWindow, QPushButton, QLabel, QVBoxLayout, QHBoxLayout, QStackedLayout, QWidget, QMenu
from PySide6.QtGui import QPixmap, QPalette, QColor


class LowOpacityRectangle(QWidget):
    def __init__(self):
        super().__init__()
        self.setAutoFillBackground(True)

        palette = self.palette()
        palette.setColor(QPalette.ColorRole.Window, QColor(0, 255, 0, 127)) # opacity ranges from 0 - 255
        self.setPalette(palette)

        self.setFixedSize(QSize(200, 200))
        self.move(200, 200)

class AnnotatedImage(QLabel):
    data_dict = {}
    PNG_WIDTH = 585
    PNG_HEIGHT = 692

    def __init__(self):
        super().__init__()

        self.setPixmap(QPixmap("landmarks.png"))
        self.setScaledContents(True)

        with open("rectangles.json", "r") as file:
            data_dict = json.load(file)

        for key, value in data_dict.items():
            rect = LowOpacityRectangle()
            rect.setParent(self)
            self.data_dict[key] = {**value, 'child': rect}

    def resizeEvent(self, event):
        super().resizeEvent(event)

        new_size = event.size()
        new_width = new_size.width()
        new_height = new_size.height()
        print("Image resized (", new_width, ", ", new_height, ")")

        for key, value in self.data_dict.items():
            rect = value['child']
            x = value['x']
            y = value['y']
            width = value['width']
            height = value['height']
            if rect and x and y and width and height:
                rect.setFixedSize(QSize(width / self.PNG_WIDTH * new_width, height / self.PNG_HEIGHT * new_height))
                rect.move(x / self.PNG_WIDTH * new_width, y / self.PNG_HEIGHT * new_height)
       

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
